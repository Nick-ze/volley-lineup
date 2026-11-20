/**
 * Rotation rules (docs/PLAN.md §4). Pure functions, no React, no storage.
 *
 * Positions: 1 = back right (server), 2 = front right, 3 = front middle, 4 = front left,
 * 5 = back left, 6 = back middle. Rotating (after a side-out) moves every player clockwise:
 * 2→1, 3→2, 4→3, 5→4, 6→5, 1→6. Rotation 1 is the starting lineup.
 */
import { COURT_POSITIONS, type CourtPosition, type SetLineup } from './types';

export type Slots = SetLineup['slots'];

/** Rotation number 1–6 (rotation 1 = the starting lineup). */
export type RotationNumber = 1 | 2 | 3 | 4 | 5 | 6;

export const ROTATION_NUMBERS: readonly RotationNumber[] = [1, 2, 3, 4, 5, 6] as const;
export const ROTATION_COUNT = 6;

export const FRONT_ROW_POSITIONS: readonly CourtPosition[] = [2, 3, 4] as const;
export const BACK_ROW_POSITIONS: readonly CourtPosition[] = [1, 5, 6] as const;

/** The serving position (back right). */
export const serverPosition: CourtPosition = 1;

export function isFrontRow(position: CourtPosition): boolean {
  return FRONT_ROW_POSITIONS.includes(position);
}

export function isBackRow(position: CourtPosition): boolean {
  return !isFrontRow(position);
}

/** The position directly across the court (1↔4, 2↔5, 3↔6). */
export function oppositePosition(position: CourtPosition): CourtPosition {
  return (((position + 2) % 6) + 1) as CourtPosition;
}

export function isRotationNumber(n: unknown): n is RotationNumber {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= ROTATION_COUNT;
}

/** The position a player at `position` moves to after one clockwise rotation (2→1, …, 1→6). */
export function nextPositionClockwise(position: CourtPosition): CourtPosition {
  return (position === 1 ? 6 : position - 1) as CourtPosition;
}

/** One clockwise rotation: the player at 2 moves to 1, 3→2, 4→3, 5→4, 6→5, 1→6. */
export function rotateClockwise(slots: Slots): Slots {
  const next = { ...slots };
  for (const position of COURT_POSITIONS) {
    next[nextPositionClockwise(position)] = slots[position];
  }
  return next;
}

/**
 * Rotates `steps` times clockwise. Any integer is allowed: negative steps rotate back,
 * and every 6 steps return to the start (so step 6 ≡ 0, i.e. "rotation 7 ≡ rotation 1").
 */
export function rotateBy(slots: Slots, steps: number): Slots {
  if (!Number.isInteger(steps)) {
    throw new RangeError(`rotateBy: steps must be an integer, got ${steps}`);
  }
  const normalized = ((steps % ROTATION_COUNT) + ROTATION_COUNT) % ROTATION_COUNT;
  let result = { ...slots };
  for (let i = 0; i < normalized; i += 1) result = rotateClockwise(result);
  return result;
}

/** The lineup on court in rotation `n` (1–6). Throws a RangeError for anything else. */
export function getRotation(slots: Slots, n: number): Slots {
  if (!isRotationNumber(n)) {
    throw new RangeError(`getRotation: rotation must be an integer 1–6, got ${n}`);
  }
  return rotateBy(slots, n - 1);
}

/** All six rotations, index 0 = rotation 1. */
export function getAllRotations(slots: Slots): Slots[] {
  return ROTATION_NUMBERS.map((n) => getRotation(slots, n));
}

/** The rotation after `n`, wrapping 6 → 1. */
export function nextRotation(n: RotationNumber): RotationNumber {
  return ((n % ROTATION_COUNT) + 1) as RotationNumber;
}

/** The rotation before `n`, wrapping 1 → 6. */
export function previousRotation(n: RotationNumber): RotationNumber {
  return (n === 1 ? ROTATION_COUNT : n - 1) as RotationNumber;
}
