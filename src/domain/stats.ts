/**
 * Statistics (docs/PLAN.md §15.2). Pure functions, no React, no storage.
 *
 * Everything is derived from the sets' event logs, replayed rally by rally (`replaySteps`):
 *
 * - **Rotations**: a rally counts for our rotation it was played in (before the side-out it may
 *   cause). Received = the opponent served; a side-out = a received rally we won. Break point = a
 *   rally won on our serve. Side-out % = side-outs ÷ received (null when nothing was received).
 * - **Players**: a set counts only once it has at least one rally. *Started* = in the stored
 *   starting six; the libero counts as started only if their swap applied in at least one rally.
 *   *Played* = among the six on court in at least one rally, or (libero) swapped in for at least
 *   one rally; a starter waiting while the libero stands in is still part of the six. Subbed in /
 *   out = applied substitutions only (skipped `INVALID_SUB` events don't count). Substitutions in
 *   a set with no rallies count for nobody (the set adds no row at all); in a played set they all
 *   count, including those after its last rally.
 * - **Serve turns**: a run of consecutive rallies served by us with the same server is one turn
 *   for that server. So a turn starts at our first serve of the set (or after each side-out), and
 *   a substitution of the server during a turn starts a new turn for the new server. A server
 *   subbed out and back within one serving run (with rallies served by the substitute between)
 *   has two turns; subbed out and back with no rally between, it stays one turn.
 * - **Tags**: kill / ace / block / ourError with a player add to that player's kills / aces /
 *   blocks / errors.
 * - **Matches**: only the sets that count for the result (`getMatchState`) — sets stored after
 *   the deciding set are ignored, as for the result.
 */
import { findLiberoSwap } from './liberoSwap';
import { replaySteps, type Score } from './liveSet';
import { getMatchState } from './matchState';
import { ROTATION_NUMBERS, serverPosition, type RotationNumber } from './rotation';
import {
  COURT_POSITIONS,
  type Match,
  type Player,
  type PointKind,
  type SetLineup,
  type SetNumber,
} from './types';

/** Rallies of one of our rotations. */
export interface RotationStats {
  rotation: RotationNumber;
  won: number;
  lost: number;
  /** Rallies the opponent served. */
  received: number;
  /** Received rallies we won. */
  sideOuts: number;
  /** Rallies we served. */
  served: number;
  /** Rallies won on our serve. */
  breakPoints: number;
}

export interface PlayerStats {
  setsStarted: number;
  setsPlayed: number;
  subIn: number;
  subOut: number;
  serveTurns: number;
  /** Rallies won while this player served. */
  servePoints: number;
  kills: number;
  aces: number;
  blocks: number;
  errors: number;
}

export interface Stats {
  /** Rallies won by each side. */
  points: Score;
  /** Rotations 1–6, in order. */
  rotations: RotationStats[];
  /** By player id; only players with something to count. */
  players: Record<string, PlayerStats>;
}

export interface SeasonOverview {
  /** Matches with at least one rally. */
  played: number;
  won: number;
  lost: number;
  inProgress: number;
  /** Sets won by each side. */
  sets: Score;
  /** Rallies won by each side. */
  points: Score;
}

const TAG_FIELDS: Partial<Record<PointKind, 'kills' | 'aces' | 'blocks' | 'errors'>> = {
  kill: 'kills',
  ace: 'aces',
  block: 'blocks',
  ourError: 'errors',
};

const emptyRotation = (rotation: RotationNumber): RotationStats => ({
  rotation,
  won: 0,
  lost: 0,
  received: 0,
  sideOuts: 0,
  served: 0,
  breakPoints: 0,
});

const emptyPlayer = (): PlayerStats => ({
  setsStarted: 0,
  setsPlayed: 0,
  subIn: 0,
  subOut: 0,
  serveTurns: 0,
  servePoints: 0,
  kills: 0,
  aces: 0,
  blocks: 0,
  errors: 0,
});

/** Stats with nothing counted. */
export function emptyStats(): Stats {
  return {
    points: { us: 0, them: 0 },
    rotations: ROTATION_NUMBERS.map(emptyRotation),
    players: {},
  };
}

/** Side-outs ÷ received rallies (0–1), or null when nothing was received. */
export function sideOutRate(line: Pick<RotationStats, 'received' | 'sideOuts'>): number | null {
  return line.received === 0 ? null : line.sideOuts / line.received;
}

/** The statistics of one set. */
export function setStats(set: SetLineup, players: readonly Player[]): Stats {
  const stats = emptyStats();
  const steps = replaySteps(set, players);
  if (!steps.some((s) => s.type === 'point')) return stats;

  const player = (id: string): PlayerStats => (stats.players[id] ??= emptyPlayer());
  const played = new Set<string>();
  let liberoOnCourt = false;
  let lastServer: string | null = null;

  for (const step of steps) {
    if (step.type === 'sub') {
      if (step.applied) {
        player(step.event.outPlayerId).subOut += 1;
        player(step.event.inPlayerId).subIn += 1;
      }
      continue;
    }
    const { event, servingSide, slots } = step;
    const won = event.winner === 'us';
    const line = stats.rotations[step.rotation - 1] as RotationStats;
    stats.points[event.winner] += 1;
    line[won ? 'won' : 'lost'] += 1;
    for (const p of COURT_POSITIONS) if (slots[p] !== null) played.add(slots[p] as string);
    const serving = servingSide === 'us';
    if (findLiberoSwap(slots, set.liberoId, set.liberoReplaces, { serving })) liberoOnCourt = true;

    const server = serving ? slots[serverPosition] : null;
    if (serving) {
      line.served += 1;
      if (won) line.breakPoints += 1;
    } else {
      line.received += 1;
      if (won) line.sideOuts += 1;
    }
    if (server !== null) {
      if (server !== lastServer) player(server).serveTurns += 1;
      if (won) player(server).servePoints += 1;
    }
    lastServer = server;

    const field = event.kind === undefined ? undefined : TAG_FIELDS[event.kind];
    if (field !== undefined && event.playerId !== undefined) player(event.playerId)[field] += 1;
  }

  for (const p of COURT_POSITIONS) {
    const id = set.slots[p];
    if (id !== null) player(id).setsStarted += 1;
  }
  if (liberoOnCourt) {
    const libero = player(set.liberoId as string);
    libero.setsStarted += 1;
    libero.setsPlayed += 1;
  }
  for (const id of played) player(id).setsPlayed += 1;
  return stats;
}

/** Adds up several stats. */
export function combineStats(list: readonly Stats[]): Stats {
  const total = emptyStats();
  for (const stats of list) {
    total.points.us += stats.points.us;
    total.points.them += stats.points.them;
    stats.rotations.forEach((line, i) => {
      const sum = total.rotations[i] as RotationStats;
      sum.won += line.won;
      sum.lost += line.lost;
      sum.received += line.received;
      sum.sideOuts += line.sideOuts;
      sum.served += line.served;
      sum.breakPoints += line.breakPoints;
    });
    for (const [id, line] of Object.entries(stats.players)) {
      const sum = (total.players[id] ??= emptyPlayer());
      for (const key of Object.keys(line) as (keyof PlayerStats)[]) sum[key] += line[key];
    }
  }
  return total;
}

/** The match's sets that count for the result, in set order. */
function countedSets(match: Pick<Match, 'sets'>): SetLineup[] {
  const numbers = new Set(getMatchState(match).sets.map((s) => s.setNumber));
  return [...match.sets]
    .filter((s) => numbers.has(s.setNumber))
    .sort((a, b) => a.setNumber - b.setNumber);
}

/** Numbers of the counted sets with at least one rally (the options of a set filter). */
export function playedSetNumbers(match: Pick<Match, 'sets'>): SetNumber[] {
  return countedSets(match)
    .filter((s) => s.events.some((e) => e.type === 'point'))
    .map((s) => s.setNumber);
}

/** The statistics of a match, or of one of its sets (`setNumber`). */
export function matchStats(
  match: Pick<Match, 'sets'>,
  players: readonly Player[],
  setNumber: SetNumber | null = null,
): Stats {
  const sets = countedSets(match).filter((s) => setNumber === null || s.setNumber === setNumber);
  return combineStats(sets.map((s) => setStats(s, players)));
}

/** The statistics of all of a team's matches. */
export function seasonStats(matches: readonly Match[], players: readonly Player[]): Stats {
  return combineStats(matches.map((m) => matchStats(m, players)));
}

/** Season record: matches won / lost / in progress, sets and points won : lost. */
export function seasonOverview(matches: readonly Pick<Match, 'sets'>[]): SeasonOverview {
  const overview: SeasonOverview = {
    played: 0,
    won: 0,
    lost: 0,
    inProgress: 0,
    sets: { us: 0, them: 0 },
    points: { us: 0, them: 0 },
  };
  for (const match of matches) {
    const state = getMatchState(match);
    if (state.status === 'notStarted') continue;
    overview.played += 1;
    if (state.status === 'won') overview.won += 1;
    else if (state.status === 'lost') overview.lost += 1;
    else overview.inProgress += 1;
    overview.sets.us += state.setsWon.us;
    overview.sets.them += state.setsWon.them;
    for (const set of state.sets) {
      overview.points.us += set.score.us;
      overview.points.them += set.score.them;
    }
  }
  return overview;
}

/** Players with stats, in jersey-number order, each with their numbers. */
export function playerStatRows(
  stats: Stats,
  players: readonly Player[],
): { player: Player; stats: PlayerStats }[] {
  return players
    .filter((p) => stats.players[p.id] !== undefined)
    .sort((a, b) => a.number - b.number)
    .map((p) => ({ player: p, stats: stats.players[p.id] as PlayerStats }));
}
