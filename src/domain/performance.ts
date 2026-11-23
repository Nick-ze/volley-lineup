/**
 * v6.0 player performance (docs/PLAN.md §25.2, §25.4): how much each player played and how
 * well, per set, per match and over the season. Pure functions, no React, no storage.
 *
 * Built on the same replay as `stats.ts` (and the same rules: only counted sets with a rally,
 * started / played / subs / serve turns / tags exactly as there, DECISIONS #94–97), plus:
 *
 * - **Rallies on court** = rallies the player actually stood on court for: the six of that
 *   rally with the libero swap of that moment applied. So the libero counts the rallies they
 *   played, and a middle the libero replaced in the back row doesn't count those.
 * - **Won / lost** = those rallies won / lost by us; **plus/minus** = won − lost.
 * - **Serves** = rallies the player served (our serve, at position 1); **serve points** = of
 *   those won.
 * - **Errors by type** (v7): "our error" tags naming the player, by `errorType`; no type =
 *   `unspecified`.
 * - **Net points** = kills + aces + blocks − errors (points the player decided themselves).
 * - **Rating** (the one-glance verdict on the performance tab): the sign of the net points
 *   when the player has any tagged action; without tags, the sign of plus/minus; null without
 *   rallies on court. `positive` / `even` / `negative`.
 * - **Error rate** = errors ÷ rallies on court; **errors per action** = errors ÷ (kills + aces +
 *   blocks + errors); **serve error rate** = serve errors ÷ serves; **attack error rate** =
 *   attack errors ÷ (kills + attack errors). Each is null when its divisor is 0.
 */
import { applyLiberoSwaps } from './liberoSwap';
import { replaySteps } from './liveSet';
import { memoByIdentity2 } from './memo';
import { serverPosition } from './rotation';
import { countedSets, setStats, type PlayerStats } from './stats';
import {
  COURT_POSITIONS,
  ERROR_TYPES,
  type ErrorType,
  type Match,
  type Player,
  type SetLineup,
  type SetNumber,
} from './types';

/** An error type, or `unspecified` for an "our error" tag without one. */
export type ErrorCategory = ErrorType | 'unspecified';
/** Error categories in display order. */
export const ERROR_CATEGORIES: readonly ErrorCategory[] = [...ERROR_TYPES, 'unspecified'];

export interface PlayerPerformance extends PlayerStats {
  /** Rallies on court (libero swap applied). */
  rallies: number;
  /** Rallies on court won by us. */
  won: number;
  /** Rallies on court lost by us. */
  lost: number;
  /** Rallies this player served. */
  serves: number;
  /** "Our error" tags naming this player, by type. Adds up to `errors`. */
  errorsByType: Record<ErrorCategory, number>;
}

export interface Performance {
  /** All rallies of the sets counted (the team's total, for "x of y rallies"). */
  rallies: number;
  /** By player id; only players with something to count. */
  players: Record<string, PlayerPerformance>;
}

export type Rating = 'positive' | 'even' | 'negative';

const emptyErrors = (): Record<ErrorCategory, number> =>
  Object.fromEntries(ERROR_CATEGORIES.map((c) => [c, 0])) as Record<ErrorCategory, number>;

/** A performance line with nothing counted. */
export function emptyPlayerPerformance(): PlayerPerformance {
  return {
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
    rallies: 0,
    won: 0,
    lost: 0,
    serves: 0,
    errorsByType: emptyErrors(),
  };
}

/** Adds `line` into `sum` (mutates `sum`). */
function addInto(sum: PlayerPerformance, line: PlayerPerformance): void {
  for (const key of Object.keys(line) as (keyof PlayerPerformance)[]) {
    if (key === 'errorsByType') continue;
    sum[key] += line[key];
  }
  for (const c of ERROR_CATEGORIES) sum.errorsByType[c] += line.errorsByType[c];
}

/** The performance of every player in one set. v8.3: cached per set and players (never mutate it). */
export const setPerformance = memoByIdentity2(setPerformanceOf);

function setPerformanceOf(set: SetLineup, players: readonly Player[]): Performance {
  const result: Performance = { rallies: 0, players: {} };
  const base = setStats(set, players);
  for (const [id, stats] of Object.entries(base.players)) {
    result.players[id] = { ...emptyPlayerPerformance(), ...stats };
  }
  // Everyone on court in a rally, the server and every tagged player already has a line in
  // `setStats` (played / libero swapped in / tagged), so every lookup below finds one.
  const line = (id: string) => result.players[id] as PlayerPerformance;

  for (const step of replaySteps(set, players)) {
    if (step.type !== 'point') continue;
    const serving = step.servingSide === 'us';
    const won = step.event.winner === 'us';
    const court = applyLiberoSwaps(step.slots, set.liberoId, step.liberoReplaces, { serving });
    result.rallies += 1;
    for (const p of COURT_POSITIONS) {
      const id = court[p];
      if (id === null) continue;
      const l = line(id);
      l.rallies += 1;
      l[won ? 'won' : 'lost'] += 1;
    }
    const server = serving ? court[serverPosition] : null;
    if (server !== null) line(server).serves += 1;
    const { kind, playerId, errorType } = step.event;
    if (kind === 'ourError' && playerId !== undefined) {
      line(playerId).errorsByType[errorType ?? 'unspecified'] += 1;
    }
  }
  return result;
}

/** Adds up several performances. */
export function combinePerformance(list: readonly Performance[]): Performance {
  const total: Performance = { rallies: 0, players: {} };
  for (const perf of list) {
    total.rallies += perf.rallies;
    for (const [id, line] of Object.entries(perf.players)) {
      addInto((total.players[id] ??= emptyPlayerPerformance()), line);
    }
  }
  return total;
}

/** The performance in a match, or in one of its sets (`setNumber`); counted sets only. */
export function matchPerformance(
  match: Pick<Match, 'sets'>,
  players: readonly Player[],
  setNumber: SetNumber | null = null,
): Performance {
  const sets = countedSets(match).filter((s) => setNumber === null || s.setNumber === setNumber);
  return combinePerformance(sets.map((s) => setPerformance(s, players)));
}

export interface PlayerMatchLine {
  match: Match;
  /** The team's rallies in the match (counted sets). */
  rallies: number;
  performance: PlayerPerformance;
}

export interface PlayerSeason {
  /** The team's rallies in the matches the player appears in. */
  rallies: number;
  total: PlayerPerformance;
  /** Matches the player has something counted in, in the given order. */
  matches: PlayerMatchLine[];
}

/** A player's season: the total and one line per match they appear in. */
export function playerSeason(
  matches: readonly Match[],
  players: readonly Player[],
  playerId: string,
): PlayerSeason {
  const season: PlayerSeason = { rallies: 0, total: emptyPlayerPerformance(), matches: [] };
  for (const match of matches) {
    const perf = matchPerformance(match, players);
    const line = perf.players[playerId];
    if (line === undefined) continue;
    season.rallies += perf.rallies;
    addInto(season.total, line);
    season.matches.push({ match, rallies: perf.rallies, performance: line });
  }
  return season;
}

/* ------------------------------------------------------------------ derived numbers */

const ratio = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);

/** Won − lost while on court. */
export function plusMinus(p: Pick<PlayerPerformance, 'won' | 'lost'>): number {
  return p.won - p.lost;
}

/** Kills + aces + blocks − errors. */
export function netPoints(
  p: Pick<PlayerPerformance, 'kills' | 'aces' | 'blocks' | 'errors'>,
): number {
  return p.kills + p.aces + p.blocks - p.errors;
}

/** The one-glance verdict (see the module comment); null without rallies on court. */
export function rating(p: PlayerPerformance): Rating | null {
  if (p.rallies === 0) return null;
  const tagged = p.kills + p.aces + p.blocks + p.errors > 0;
  const value = tagged ? netPoints(p) : plusMinus(p);
  return value > 0 ? 'positive' : value < 0 ? 'negative' : 'even';
}

/** Errors ÷ rallies on court (0–1), or null without rallies. */
export function errorRate(p: Pick<PlayerPerformance, 'errors' | 'rallies'>): number | null {
  return ratio(p.errors, p.rallies);
}

/** Errors ÷ tagged actions (kills + aces + blocks + errors), or null without any. */
export function errorsPerAction(
  p: Pick<PlayerPerformance, 'kills' | 'aces' | 'blocks' | 'errors'>,
): number | null {
  return ratio(p.errors, p.kills + p.aces + p.blocks + p.errors);
}

/** Serve errors ÷ serves, or null without serves. */
export function serveErrorRate(p: PlayerPerformance): number | null {
  return ratio(p.errorsByType.serve, p.serves);
}

/** Attack errors ÷ (kills + attack errors), or null without either. */
export function attackErrorRate(p: PlayerPerformance): number | null {
  return ratio(p.errorsByType.attack, p.kills + p.errorsByType.attack);
}

/** The error categories with at least one error, in display order ("3 reception, 5 attack"). */
export function errorBreakdown(
  p: Pick<PlayerPerformance, 'errorsByType'>,
): { category: ErrorCategory; count: number }[] {
  return ERROR_CATEGORIES.filter((c) => p.errorsByType[c] > 0).map((category) => ({
    category,
    count: p.errorsByType[category],
  }));
}

const RATING_ORDER: Record<Rating | 'none', number> = {
  positive: 0,
  even: 1,
  negative: 2,
  none: 3,
};

/**
 * v6.2: best first. Compares by the rating (positive → even → negative → no rallies, so the
 * badges never jump around), then net points, plus/minus and rallies on court (all higher
 * first); negative when `a` ranks above `b`.
 */
export function compareByPerformance(a: PlayerPerformance, b: PlayerPerformance): number {
  return (
    RATING_ORDER[rating(a) ?? 'none'] - RATING_ORDER[rating(b) ?? 'none'] ||
    netPoints(b) - netPoints(a) ||
    plusMinus(b) - plusMinus(a) ||
    b.rallies - a.rallies
  );
}

/**
 * Rows for the performance tab: every player with a line, best first and worst last
 * (`compareByPerformance`), equal ones by jersey number. Players no longer on the roster are
 * left out.
 */
export function performanceRows(
  perf: Performance,
  players: readonly Player[],
): { player: Player; performance: PlayerPerformance }[] {
  return players
    .filter((p) => perf.players[p.id] !== undefined)
    .map((p) => ({ player: p, performance: perf.players[p.id] as PlayerPerformance }))
    .sort(
      (a, b) =>
        compareByPerformance(a.performance, b.performance) || a.player.number - b.player.number,
    );
}
