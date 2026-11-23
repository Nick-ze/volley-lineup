/**
 * Set scoring rules: the target, the winner and the set point of a set score. Pure, no React.
 *
 * Part of the live-set modules (v8.3 split of `liveSet.ts`, which re-exports the public names):
 * import this module directly inside the domain, never through `liveSet.ts`.
 */
import type { SetLineup, Side } from './types';

export interface Score {
  us: number;
  them: number;
}

/** Points needed to win a set: 25, or 15 in the deciding fifth set. */
export function targetPoints(setNumber: SetLineup['setNumber']): number {
  return setNumber === 5 ? 15 : 25;
}

const other = (side: Side): Side => (side === 'us' ? 'them' : 'us');

/** The side that has won the set (target reached, lead ≥ 2), or null. */
export function setWinnerOf(score: Score, target: number): Side | null {
  for (const side of ['us', 'them'] as const) {
    if (score[side] >= target && score[side] - score[other(side)] >= 2) return side;
  }
  return null;
}

/** The side one point from winning (≥ target − 1 and ahead), or null; null once the set is won. */
export function setPointOf(score: Score, target: number): Side | null {
  if (setWinnerOf(score, target)) return null;
  for (const side of ['us', 'them'] as const) {
    if (score[side] >= target - 1 && score[side] > score[other(side)]) return side;
  }
  return null;
}
