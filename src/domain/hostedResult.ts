/**
 * v12 hosted tournaments: a match's result. Sets are typed in (two whole numbers 0–99 that
 * differ; no rule on how long a set is). Whether the match is over, who won it and whether
 * another set may be entered follow from the tournament's settings.
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import type {
  HostedResult,
  HostedSetScore,
  HostedTournament,
  MatchEnd,
  SetsPerMatch,
} from './types';

export const MAX_SET_SCORE = 99;

/** The settings a result is read with. */
export type HostedSettings = Pick<HostedTournament, 'setsPerMatch' | 'matchEnd'>;

/** `bestOf` needs an odd number of sets; with 2 or 4 every set is played. */
export const bestOfAllowed = (setsPerMatch: SetsPerMatch): boolean => setsPerMatch % 2 === 1;

/** The ways a match can end with this many sets (the default first). */
export const matchEndChoices = (setsPerMatch: SetsPerMatch): MatchEnd[] =>
  bestOfAllowed(setsPerMatch) ? ['bestOf', 'allSets'] : ['allSets'];

/** The setting kept when the number of sets changes: `allSets` where best-of isn't possible. */
export const matchEndFor = (setsPerMatch: SetsPerMatch, wanted: MatchEnd): MatchEnd =>
  bestOfAllowed(setsPerMatch) ? wanted : 'allSets';

/** Sets a team must win to end a best-of match. */
export const setsToWin = (setsPerMatch: SetsPerMatch): number => Math.floor(setsPerMatch / 2) + 1;

const isScore = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= MAX_SET_SCORE;

export type SetScoreError = 'RANGE' | 'EQUAL';

/** Why a set can't be stored, or null: both scores 0–99 (whole numbers) and different. */
export function setScoreError(set: HostedSetScore): SetScoreError | null {
  if (!isScore(set.a) || !isScore(set.b)) return 'RANGE';
  return set.a === set.b ? 'EQUAL' : null;
}

export type MatchState = 'open' | 'running' | 'done';
export type MatchWinner = 'a' | 'b' | 'draw';

export interface MatchOutcome {
  /** Sets won. */
  setsA: number;
  setsB: number;
  /** Ball points over all sets. */
  ballsA: number;
  ballsB: number;
  /** `open`: no set yet; `running`: some sets, not over; `done`: the match is over. */
  state: MatchState;
  /** Only when `done`: the winner, or `draw` (all sets played, equal sets). */
  winner: MatchWinner | null;
}

function decided(setsA: number, setsB: number, played: number, settings: HostedSettings): boolean {
  if (settings.matchEnd === 'allSets') return played >= settings.setsPerMatch;
  const need = setsToWin(settings.setsPerMatch);
  return setsA >= need || setsB >= need;
}

/** What a list of (valid) sets means under the tournament's settings. */
export function matchOutcome(
  sets: readonly HostedSetScore[],
  settings: HostedSettings,
): MatchOutcome {
  let setsA = 0;
  let setsB = 0;
  let ballsA = 0;
  let ballsB = 0;
  for (const set of sets) {
    if (set.a > set.b) setsA += 1;
    else if (set.b > set.a) setsB += 1;
    ballsA += set.a;
    ballsB += set.b;
  }
  const done = sets.length > 0 && decided(setsA, setsB, sets.length, settings);
  const state: MatchState = done ? 'done' : sets.length === 0 ? 'open' : 'running';
  const winner: MatchWinner | null = !done
    ? null
    : setsA > setsB
      ? 'a'
      : setsB > setsA
        ? 'b'
        : 'draw';
  return { setsA, setsB, ballsA, ballsB, state, winner };
}

export type ResultError = 'EMPTY' | 'TOO_MANY_SETS' | 'INVALID_SET' | 'SET_AFTER_DECIDED';

export type ResultValidity = { ok: true } | { ok: false; error: ResultError; set?: number };

/**
 * Whether these sets can be stored as a result: at least one set and at most `setsPerMatch`,
 * every set valid, and in a best-of match no set after the deciding one. A result may be
 * unfinished (the match is still running).
 */
export function resultValidity(
  sets: readonly HostedSetScore[],
  settings: HostedSettings,
): ResultValidity {
  if (sets.length === 0) return { ok: false, error: 'EMPTY' };
  if (sets.length > settings.setsPerMatch) return { ok: false, error: 'TOO_MANY_SETS' };
  for (let i = 0; i < sets.length; i += 1) {
    if (setScoreError(sets[i]) !== null) return { ok: false, error: 'INVALID_SET', set: i + 1 };
    if (i > 0 && matchOutcome(sets.slice(0, i), settings).state === 'done') {
      return { ok: false, error: 'SET_AFTER_DECIDED', set: i + 1 };
    }
  }
  return { ok: true };
}

/** True when another set may be entered: every set so far is valid and the match isn't over. */
export function nextSetAllowed(sets: readonly HostedSetScore[], settings: HostedSettings): boolean {
  if (sets.length >= settings.setsPerMatch) return false;
  if (sets.some((set) => setScoreError(set) !== null)) return false;
  return matchOutcome(sets, settings).state !== 'done';
}

/** A result's sets as seen from `teamId` (`a` = that team); unchanged for the result's team A. */
export function setsSeenFrom(result: HostedResult, teamId: string): HostedSetScore[] {
  return result.teamAId === teamId ? result.sets : result.sets.map((s) => ({ a: s.b, b: s.a }));
}

/** A typed score: `''` stays empty (null), digits become a number, anything else is NaN. */
export function parseScoreInput(text: string): number | null {
  const value = text.trim();
  if (value === '') return null;
  return /^\d{1,2}$/.test(value) ? Number(value) : Number.NaN;
}

export interface SetInput {
  a: string;
  b: string;
}

export type SetInputError = SetScoreError | 'INCOMPLETE';

export type ResultFormResult =
  | { ok: true; sets: HostedSetScore[] }
  | { ok: false; errors: Partial<Record<number, SetInputError>>; resultError?: ResultError };

/**
 * Reads the result form's rows. Rows left completely empty at the end are dropped (clearing both
 * fields of the last set removes it); an empty row before a filled one, or a row with one
 * field, is incomplete. `errors` is keyed by the row's index.
 */
export function readResultForm(
  rows: readonly SetInput[],
  settings: HostedSettings,
): ResultFormResult {
  const isBlank = (row: SetInput) => row.a.trim() === '' && row.b.trim() === '';
  let end = rows.length;
  while (end > 0 && isBlank(rows[end - 1])) end -= 1;
  const errors: Partial<Record<number, SetInputError>> = {};
  const sets: HostedSetScore[] = [];
  rows.slice(0, end).forEach((row, index) => {
    const a = parseScoreInput(row.a);
    const b = parseScoreInput(row.b);
    if (a === null || b === null) {
      errors[index] = 'INCOMPLETE';
      return;
    }
    const error = setScoreError({ a, b });
    if (error !== null) errors[index] = error;
    else sets.push({ a, b });
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const validity = resultValidity(sets, settings);
  if (!validity.ok && validity.error !== 'EMPTY') {
    return { ok: false, errors: {}, resultError: validity.error };
  }
  return { ok: true, sets };
}
