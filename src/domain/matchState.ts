/**
 * Set and match results (docs/PLAN.md §15.1, §16). Pure functions, no React, no storage.
 *
 * Nothing about a result is stored: it is derived from each set's point events. A set is won at
 * 25 points (15 in set 5) with a 2-point lead; a match is won with 3 sets (best of 5). Sets after
 * the one that decided the match are ignored (they can only exist in data from before v3, when
 * set and match ends weren't enforced).
 */
import { setWinnerOf, targetPoints, type Score } from './liveSet';
import { memoByIdentity } from './memo';
import { SET_NUMBERS, type Match, type SetLineup, type SetNumber, type Side } from './types';

/** Sets needed to win a match (best of 5). */
export const SETS_TO_WIN = 3;

/** Rallies won by each side in a set (substitutions don't count). */
export function setScore(set: Pick<SetLineup, 'events'>): Score {
  const score: Score = { us: 0, them: 0 };
  for (const event of set.events) if (event.type === 'point') score[event.winner] += 1;
  return score;
}

/** The side that has won the set, or null while it is open (or not started). */
export function setWinner(set: Pick<SetLineup, 'events' | 'setNumber'>): Side | null {
  return setWinnerOf(setScore(set), targetPoints(set.setNumber));
}

export type SetStatus = 'notStarted' | 'inProgress' | 'won' | 'lost';

export interface SetResult {
  setNumber: SetNumber;
  score: Score;
  winner: Side | null;
  status: SetStatus;
}

export type MatchStatus = 'notStarted' | 'inProgress' | 'won' | 'lost';

export interface MatchState {
  /** Results of the stored sets that count, in set order (sets after the decision are left out). */
  sets: SetResult[];
  /** Sets won by each side. */
  setsWon: Score;
  /** The side that has won 3 sets, or null. */
  winner: Side | null;
  status: MatchStatus;
  /**
   * The set to play now: the first set (1–5) that hasn't been won by anyone yet — stored or not.
   * Null once the match is over.
   */
  currentSetNumber: SetNumber | null;
  /** Milliseconds from the first to the last timestamped rally; null with fewer than 2 stamps. */
  durationMs: number | null;
}

/** The result of one set. v8.3: cached per set object (shared: never mutate it). */
export const setResult = memoByIdentity(setResultOf);

function setResultOf(set: SetLineup): SetResult {
  const score = setScore(set);
  const winner = setWinnerOf(score, targetPoints(set.setNumber));
  const started = score.us + score.them > 0;
  const status: SetStatus =
    winner === 'us' ? 'won' : winner === 'them' ? 'lost' : started ? 'inProgress' : 'notStarted';
  return { setNumber: set.setNumber, score, winner, status };
}

/** Milliseconds between the first and last valid `at` stamp of the given sets' points. */
export function durationOf(sets: readonly SetLineup[]): number | null {
  const times = sets
    .flatMap((set) => set.events)
    .flatMap((e) => (e.type === 'point' && e.at !== undefined ? [Date.parse(e.at)] : []))
    .filter((t) => !Number.isNaN(t));
  if (times.length < 2) return null;
  return Math.max(...times) - Math.min(...times);
}

/**
 * The whole match's result, replayed from its sets' events. v8.3: cached per `match.sets` array,
 * which an unchanged match keeps (shared: never mutate it).
 */
export function getMatchState(match: Pick<Match, 'sets'>): MatchState {
  return matchStateOf(match.sets);
}

const matchStateOf = memoByIdentity(matchStateOfSets);

function matchStateOfSets(stored: readonly SetLineup[]): MatchState {
  const ordered = [...stored].sort((a, b) => a.setNumber - b.setNumber);
  const setsWon: Score = { us: 0, them: 0 };
  const sets: SetResult[] = [];
  const counted: SetLineup[] = [];
  let winner: Side | null = null;
  for (const set of ordered) {
    if (winner !== null) break;
    const result = setResult(set);
    sets.push(result);
    counted.push(set);
    if (result.winner !== null) {
      setsWon[result.winner] += 1;
      if (setsWon[result.winner] >= SETS_TO_WIN) winner = result.winner;
    }
  }

  const decided = new Set(sets.filter((s) => s.winner !== null).map((s) => s.setNumber));
  // Without a winner at most 4 sets are decided, so an undecided set number always exists.
  const currentSetNumber =
    winner === null ? (SET_NUMBERS.find((n) => !decided.has(n)) as SetNumber) : null;
  const started = sets.some((s) => s.status !== 'notStarted');
  const status: MatchStatus =
    winner === 'us' ? 'won' : winner === 'them' ? 'lost' : started ? 'inProgress' : 'notStarted';

  return { sets, setsWon, winner, status, currentSetNumber, durationMs: durationOf(counted) };
}
