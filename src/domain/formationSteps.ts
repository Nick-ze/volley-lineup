/**
 * A set's formation rotation by rotation (docs/PLAN.md §22 item 2, docs/VOLLEYBALL_RULES.md §2).
 * Pure, no React.
 *
 * "Steps" count rotations from the start of the set (step 1 = the starting six, step 2 = one
 * clockwise rotation, …). The formation turns with the players, so in every step each spot has a
 * role, also when nobody stands on it, and the step is named after the setter spot.
 */
import { formationRotation, spotRoles } from './roles';
import { ROTATION_COUNT, ROTATION_NUMBERS, type RotationNumber } from './rotation';
import type { CourtPosition, Formation, Position } from './types';

/** The formation after `steps` clockwise rotations (negative = back); every 6 steps return. */
export function rotateFormation(formation: Formation, steps: number): Formation {
  const shift =
    (((formation.setterAt - 1 - steps) % ROTATION_COUNT) + ROTATION_COUNT) % ROTATION_COUNT;
  return { ...formation, setterAt: (shift + 1) as CourtPosition };
}

/** The formation in rotation step `step` (1 = the starting six). */
export function formationAtStep(formation: Formation, step: RotationNumber): Formation {
  return rotateFormation(formation, step - 1);
}

/** The role of every spot in step `step`. */
export function stepSpotRoles(
  formation: Formation,
  step: RotationNumber,
): Record<CourtPosition, Position> {
  return spotRoles(formationAtStep(formation, step));
}

/**
 * The rotation number of every step (index 0 = step 1): the setter spot in that step (6-2: the
 * back-row setter spot), so a setter spot starting at 4 gives 4, 3, 2, 1, 6, 5.
 */
export function formationLabels(formation: Formation): RotationNumber[] {
  return ROTATION_NUMBERS.map((step) => formationRotation(formationAtStep(formation, step)));
}
