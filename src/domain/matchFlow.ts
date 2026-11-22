/**
 * Whole-match flow in live mode (docs/PLAN.md §15.1). Pure functions, no React, no storage.
 *
 * Decides which set live mode shows, when a set needs to be set up before it can start, who
 * serves first in a new set, which lineup sources the setup offers, and where "Undo" goes when
 * the viewed set has nothing to undo yet (the previous, won set: undoing across a set end).
 * Results themselves come from `matchState.ts` (derived, never stored).
 */
import { previousSet } from './lineupEditing';
import { getMatchState, setWinner, type MatchState } from './matchState';
import { hasAnyPlayer, namedPresetsFor, startersFor } from './presets';
import {
  COURT_POSITIONS,
  SET_NUMBERS,
  type LineupPreset,
  type Match,
  type SetLineup,
  type SetNumber,
} from './types';

/** True when all six court positions are filled (live mode needs six players). */
export function isSetComplete(set: Pick<SetLineup, 'slots'>): boolean {
  return COURT_POSITIONS.every((p) => set.slots[p] !== null);
}

/** The set that decided the match (the last counted set), or null while the match is open. */
export function decidingSetNumber(state: MatchState): SetNumber | null {
  if (state.winner === null) return null;
  return state.sets[state.sets.length - 1].setNumber;
}

/**
 * The set live mode opens: `requested` when it is a valid set number (1–5), otherwise the
 * current set, or the deciding set once the match is over.
 */
export function liveSetNumber(
  match: Pick<Match, 'sets'>,
  requested: string | string[] | undefined,
): SetNumber {
  const n = Number(Array.isArray(requested) ? requested[0] : requested);
  if (requested !== undefined && (SET_NUMBERS as readonly number[]).includes(n)) {
    return n as SetNumber;
  }
  const state = getMatchState(match);
  return state.currentSetNumber ?? (decidingSetNumber(state) as SetNumber);
}

/**
 * True when the set is the one to play now but can't start yet: it isn't stored or its six
 * positions aren't all filled (and nothing has been recorded in it).
 */
export function needsSetup(match: Pick<Match, 'sets'>, setNumber: SetNumber): boolean {
  if (getMatchState(match).currentSetNumber !== setNumber) return false;
  const set = match.sets.find((s) => s.setNumber === setNumber);
  return !set || (set.events.length === 0 && !isSetComplete(set));
}

/** The set after `setNumber`, or null after set 5. */
export function nextSetNumber(setNumber: SetNumber): SetNumber | null {
  return setNumber < 5 ? ((setNumber + 1) as SetNumber) : null;
}

/**
 * Who serves first in a new set: the team that received first in the previous set
 * (we serve first when there is no previous set).
 */
export function defaultWeServeFirst(previous: Pick<SetLineup, 'weServeFirst'> | null): boolean {
  return previous ? !previous.weServeFirst : true;
}

/**
 * The rotating serve default for `setNumber` when it is reached from the previous set: the
 * stored set with `defaultWeServeFirst(previous)` applied, or null when the set isn't stored,
 * has events, has no earlier set, or already has that serve choice (nothing to save).
 */
export function withDefaultServe(
  match: Pick<Match, 'sets'>,
  setNumber: SetNumber,
): SetLineup | null {
  const set = match.sets.find((s) => s.setNumber === setNumber);
  const previous = previousSet(match.sets, setNumber);
  if (!set || set.events.length > 0 || !previous) return null;
  const weServeFirst = defaultWeServeFirst(previous);
  return set.weServeFirst === weServeFirst ? null : { ...set, weServeFirst };
}

/**
 * True when `setNumber` comes after the set that decided the match (only possible in data from
 * before v3): such a set doesn't count and can't be played.
 */
export function isAfterDecision(state: MatchState, setNumber: SetNumber): boolean {
  const deciding = decidingSetNumber(state);
  return deciding !== null && setNumber > deciding;
}

/** True when a set after `setNumber` already has events (rallies or subs). */
export function hasLaterPlay(match: Pick<Match, 'sets'>, setNumber: SetNumber): boolean {
  return match.sets.some((s) => s.setNumber > setNumber && s.events.length > 0);
}

/**
 * The set whose last event "Undo" removes when viewing `setNumber`: the set itself when it has
 * events; otherwise the nearest earlier set with events if that set has been won (undo across a
 * set end — it re-opens that set); otherwise null (nothing to undo).
 */
export function undoTarget(match: Pick<Match, 'sets'>, setNumber: SetNumber): SetNumber | null {
  const own = match.sets.find((s) => s.setNumber === setNumber);
  if (own && own.events.length > 0) return setNumber;
  const earlier = match.sets
    .filter((s) => s.setNumber < setNumber && s.events.length > 0)
    .sort((a, b) => b.setNumber - a.setNumber)[0];
  return earlier && setWinner(earlier) !== null ? earlier.setNumber : null;
}

/** What the setup of a new set can fill it from. */
export interface SetupSources {
  /** The team's starters when they have anyone in them (v6.2: also partly filled). */
  starters: LineupPreset | null;
  /** The team's named presets, by name. */
  presets: LineupPreset[];
  /** The nearest earlier stored set (to copy), or null. */
  previous: SetLineup | null;
}

/** The lineup sources offered when setting up `setNumber` in live mode. */
export function setupSources(
  match: Pick<Match, 'sets' | 'teamId'>,
  setNumber: SetNumber,
  presets: readonly LineupPreset[],
): SetupSources {
  const starters = startersFor(presets, match.teamId);
  return {
    starters: starters && hasAnyPlayer(starters) ? starters : null,
    presets: namedPresetsFor(presets, match.teamId),
    previous: previousSet(match.sets, setNumber),
  };
}
