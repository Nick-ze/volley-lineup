/**
 * v8: which court spots slide when the lineup rotates (PLAN §31.2). A rotation moves (most)
 * players by the same number of spots; then every player — and every empty spot — slides from
 * its old spot to its new one. Anything else (a drop, a swap, a substitution) changes instantly,
 * so drag & drop is never fought by an animation. Pure functions, no React.
 */
import { COURT_POSITIONS, type CourtPosition } from './types';

/** How long a player takes to slide to their new spot (ms). */
export const COURT_SLIDE_DURATION_MS = 260;

/** Who stands on each spot (player id, or null when empty). */
export type SpotKeys = Readonly<Record<CourtPosition, string | null>>;

/** For each spot that slides: the spot its content comes from. */
export type SpotMoves = Partial<Record<CourtPosition, CourtPosition>>;

/** The spot `steps` spots further on in position order (1…6, wrapping). */
export function shiftPosition(position: CourtPosition, steps: number): CourtPosition {
  return (((((position - 1 + steps) % 6) + 6) % 6) + 1) as CourtPosition;
}

/** Same player (or nobody) on every spot. */
export function sameSpots(a: SpotKeys, b: SpotKeys): boolean {
  return COURT_POSITIONS.every((p) => a[p] === b[p]);
}

/**
 * The step most moved players share (`from - to`, 1…5), when it looks like a rotation: at least
 * two players moved, more than half of the moved players by that step, and a jump across the
 * court (3) only with three or more players (a swap of two opposite players is not a rotation).
 */
export function rotationStep(previous: SpotKeys, next: SpotKeys): number | null {
  const counts = new Map<number, number>();
  let moved = 0;
  for (const to of COURT_POSITIONS) {
    const id = next[to];
    const from = id === null ? undefined : COURT_POSITIONS.find((p) => previous[p] === id);
    if (from === undefined || from === to) continue;
    moved += 1;
    const step = (from - to + 6) % 6;
    counts.set(step, (counts.get(step) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [step, count] of counts) {
    if (count > bestCount) {
      best = step;
      bestCount = count;
    }
  }
  if (best === null || bestCount < 2 || bestCount * 2 <= moved) return null;
  if (best === 3 && bestCount < 3) return null;
  return best;
}

/**
 * The slides of a rotation from `previous` to `next`: every player that moved by the rotation
 * step slides from their old spot; an empty spot slides from where it was (if that spot was
 * empty too). Players that came on (libero, substitute) or moved otherwise just appear.
 */
export function spotMoves(previous: SpotKeys, next: SpotKeys): SpotMoves {
  const step = rotationStep(previous, next);
  if (step === null) return {};
  const moves: SpotMoves = {};
  for (const to of COURT_POSITIONS) {
    const from = shiftPosition(to, step);
    const id = next[to];
    if (previous[from] === id) moves[to] = from;
  }
  return moves;
}
