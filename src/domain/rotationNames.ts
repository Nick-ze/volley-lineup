/**
 * Rotation numbers named after the setter (docs/PLAN.md §19 item 4, DECISIONS #117) for a
 * lineup viewed rotation by rotation. Pure, no React.
 *
 * "Steps" count rotations from the start of the set (step 1 = the starting six, step 2 = one
 * clockwise rotation, …). The label of a step is the setter's court position in it, so a setter
 * starting at 4 gives the labels 4, 3, 2, 1, 6, 5. Without a setter the step is its own label.
 */
import { setterRotation } from './roles';
import { getRotation, ROTATION_NUMBERS, type RotationNumber, type Slots } from './rotation';
import type { PlayerRoles } from './types';

/** The label of every step (index 0 = step 1). */
export function rotationLabels(slots: Slots, roles: Readonly<PlayerRoles>): RotationNumber[] {
  return ROTATION_NUMBERS.map((step) => setterRotation(getRotation(slots, step), roles) ?? step);
}

/** The steps ordered by label (ties — two setters, 6-2 — by step): the order of a 1–6 jump row. */
export function stepsByLabel(labels: readonly RotationNumber[]): RotationNumber[] {
  return [...ROTATION_NUMBERS].sort((a, b) => labels[a - 1] - labels[b - 1] || a - b);
}
