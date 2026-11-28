/**
 * v12.2 hosted tournaments: live scoring of a match, point by point — only the score (no
 * lineups, rotations or serve). A set ends when the scorer says so, because a hosted tournament
 * has no rule on how long a set is. A point can be tagged with how it was won and, when the team
 * has players, by whom. Pure: every step returns a new state.
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import { matchOutcome, nextSetAllowed, type HostedSettings } from './hostedResult';
import type { HostedPoint, HostedPointKind, HostedResult, HostedSetScore } from './types';

/** What live scoring reads and writes of a result. */
export interface LiveState {
  /** The finished sets. */
  sets: HostedSetScore[];
  /** The rallies per set (see `HostedResult.live`). */
  live: HostedPoint[][];
}

/** The live state of a stored result, or of a match without one. */
export function liveStateOf(result: Pick<HostedResult, 'sets' | 'live'> | undefined): LiveState {
  const sets = result?.sets ?? [];
  // Sets that were typed in have no rallies: an empty list stands for each.
  const live = result?.live ?? sets.map(() => []);
  return { sets, live };
}

/** The score of a list of rallies. */
export function scoreOf(points: readonly HostedPoint[]): HostedSetScore {
  let a = 0;
  let b = 0;
  for (const point of points) {
    if (point.team === 'a') a += 1;
    else b += 1;
  }
  return { a, b };
}

/** The rallies of the set being played, or null between sets. */
export function runningPoints(state: LiveState): HostedPoint[] | null {
  return state.live.length > state.sets.length ? state.live[state.sets.length] : null;
}

/** The score of the set being played (null between sets). */
export function runningScore(state: LiveState): HostedSetScore | null {
  const points = runningPoints(state);
  return points === null ? null : scoreOf(points);
}

export type LivePhase = 'playing' | 'between' | 'over';

export interface LiveStatus {
  /** `playing`: a set is running; `between`: the next set can start; `over`: the match is. */
  phase: LivePhase;
  /** The number of the running or next set (the last one when the match is over). */
  setNumber: number;
  /** The running set's score; 0:0 between sets and when the match is over. */
  score: HostedSetScore;
  /** Sets won so far. */
  setsA: number;
  setsB: number;
  /** A point can be scored (a set is running, or the next one may start). */
  canScore: boolean;
  /** The running set can be ended: its two scores differ. */
  canEndSet: boolean;
  /** There is something to undo. */
  canUndo: boolean;
}

/** Where live scoring stands. */
export function liveStatus(state: LiveState, settings: HostedSettings): LiveStatus {
  const outcome = matchOutcome(state.sets, settings);
  const score = runningScore(state);
  const playing = score !== null;
  const canStart = !playing && nextSetAllowed(state.sets, settings);
  const lastLog = state.live[state.sets.length - 1];
  return {
    phase: playing ? 'playing' : canStart ? 'between' : 'over',
    setNumber: playing || canStart ? state.sets.length + 1 : Math.max(1, state.sets.length),
    score: score ?? { a: 0, b: 0 },
    setsA: outcome.setsA,
    setsB: outcome.setsB,
    canScore: playing || canStart,
    canEndSet: playing && score.a !== score.b,
    // A finished set can be re-opened only when its rallies are known.
    canUndo: playing || (lastLog !== undefined && lastLog.length > 0),
  };
}

/** A point for `team`. Starts the next set when none is running; nothing when the match is over. */
export function addPoint(state: LiveState, team: 'a' | 'b', settings: HostedSettings): LiveState {
  if (!liveStatus(state, settings).canScore) return state;
  const running = runningPoints(state) ?? [];
  return {
    sets: state.sets,
    live: [...state.live.slice(0, state.sets.length), [...running, { team }]],
  };
}

/** Ends the running set: its score joins the finished sets. Nothing while the scores are equal. */
export function endSet(state: LiveState): LiveState {
  const score = runningScore(state);
  if (score === null || score.a === score.b) return state;
  return { sets: [...state.sets, score], live: state.live };
}

/**
 * Takes back the last step: the running set's last rally (a set without rallies is no longer
 * running), or — between sets and after the match — the end of the last set, which is running
 * again with all its rallies. A set whose score was typed in can't be re-opened.
 */
export function undoLast(state: LiveState): LiveState {
  const running = runningPoints(state);
  if (running !== null) {
    const rest = running.slice(0, -1);
    const before = state.live.slice(0, state.sets.length);
    return { sets: state.sets, live: rest.length === 0 ? before : [...before, rest] };
  }
  const last = state.live[state.sets.length - 1];
  if (last === undefined || last.length === 0) return state;
  return { sets: state.sets.slice(0, -1), live: state.live };
}

/**
 * Where the last rally is: its set's index and its own. Null when there is none, or when the
 * last set's score was typed in (its rallies aren't known).
 */
function lastPointAt(state: LiveState): { set: number; index: number } | null {
  const set = state.live.length - 1;
  const points = state.live[set];
  return points === undefined || points.length === 0 ? null : { set, index: points.length - 1 };
}

/** The last rally — the only one that can be tagged — or null. */
export function lastPoint(state: LiveState): HostedPoint | null {
  const at = lastPointAt(state);
  return at === null ? null : state.live[at.set][at.index];
}

/**
 * Tags the last rally: how the point was won and, optionally, by whom (`kind: null` removes the
 * tag). Whether the player fits the kind is the caller's business (`tagPlayers`).
 */
export function tagLastPoint(
  state: LiveState,
  kind: HostedPointKind | null,
  playerId: string | null = null,
): LiveState {
  const at = lastPointAt(state);
  if (at === null) return state;
  const { team } = state.live[at.set][at.index];
  const tagged: HostedPoint =
    kind === null ? { team } : { team, kind, ...(playerId === null ? {} : { playerId }) };
  const live = state.live.map((points, set) =>
    set === at.set ? points.map((p, index) => (index === at.index ? tagged : p)) : points,
  );
  return { sets: state.sets, live };
}

/** Whose player a tag of this kind names: the scoring team's, or (an error) the other team's. */
export const tagSide = (point: Pick<HostedPoint, 'team'>, kind: HostedPointKind): 'a' | 'b' =>
  kind === 'error' ? (point.team === 'a' ? 'b' : 'a') : point.team;

/** True when the state holds any rally (the result form is then locked: see `withoutLive`). */
export const hasLiveDetails = (result: Pick<HostedResult, 'live'> | undefined): boolean =>
  (result?.live ?? []).some((points) => points.length > 0);

/** What to store for a state: no `live` when no rally is left. */
export function storedLive(state: LiveState): Pick<HostedResult, 'sets' | 'live'> {
  return state.live.some((points) => points.length > 0)
    ? { sets: state.sets, live: state.live }
    : { sets: state.sets };
}

/** The state as seen from the other team (a ↔ b), for a result stored the other way round. */
export function flippedState(state: LiveState): LiveState {
  return {
    sets: state.sets.map((s) => ({ a: s.b, b: s.a })),
    live: state.live.map((points) =>
      points.map((p): HostedPoint => ({ ...p, team: p.team === 'a' ? 'b' : 'a' })),
    ),
  };
}

/** Per kind, how often. */
export type KindCounts = Record<HostedPointKind, number>;

export interface SideStats {
  /** Points scored (rallies won) in the live-scored sets. */
  points: number;
  /** Points won by an attack, an ace, a block — and errors this side made. */
  counts: KindCounts;
  /** The same per player of this side (only players that were named). */
  players: Map<string, KindCounts>;
}

const noCounts = (): KindCounts => ({ attack: 0, ace: 0, block: 0, error: 0 });
const noStats = (): SideStats => ({ points: 0, counts: noCounts(), players: new Map() });

/**
 * What the rallies of a match say about its two sides: "blocked 4 times", "#6 scored an ace".
 * An `error` counts for the side that made it (the side that lost the rally).
 */
export function liveStats(live: readonly (readonly HostedPoint[])[]): {
  a: SideStats;
  b: SideStats;
} {
  const stats = { a: noStats(), b: noStats() };
  for (const point of live.flat()) {
    stats[point.team].points += 1;
    if (point.kind === undefined) continue;
    const side = stats[tagSide(point, point.kind)];
    side.counts[point.kind] += 1;
    if (point.playerId === undefined) continue;
    const player = side.players.get(point.playerId) ?? noCounts();
    player[point.kind] += 1;
    side.players.set(point.playerId, player);
  }
  return stats;
}

/** Two sides' stats added up (for a team's numbers over a whole tournament). */
export function addStats(total: SideStats, more: SideStats): SideStats {
  const sum = (x: KindCounts, y: KindCounts): KindCounts => ({
    attack: x.attack + y.attack,
    ace: x.ace + y.ace,
    block: x.block + y.block,
    error: x.error + y.error,
  });
  const players = new Map(total.players);
  for (const [id, counts] of more.players)
    players.set(id, sum(players.get(id) ?? noCounts(), counts));
  return { points: total.points + more.points, counts: sum(total.counts, more.counts), players };
}

/** A team's stats over all its live-scored matches of a tournament. */
export function teamLiveStats(teamId: string, results: readonly HostedResult[]): SideStats {
  let total = noStats();
  for (const result of results) {
    if (result.live === undefined) continue;
    if (result.teamAId !== teamId && result.teamBId !== teamId) continue;
    const stats = liveStats(result.live);
    total = addStats(total, result.teamAId === teamId ? stats.a : stats.b);
  }
  return total;
}

/** True when nothing was tagged (the stats panel then has nothing to say). */
export const hasTags = (stats: SideStats): boolean =>
  stats.counts.attack + stats.counts.ace + stats.counts.block + stats.counts.error > 0;
