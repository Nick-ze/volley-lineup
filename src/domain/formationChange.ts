/**
 * Changing a lineup's formation in the builder (docs/PLAN.md §22.1). Pure functions, no React,
 * no storage.
 */
import { setFormation, startersWithRoles } from './roles';
import type { Formation, Player, SetLineup } from './types';

/**
 * `setFormation` plus the libero: when the libero replaced exactly the old middles (the usual
 * choice), it follows the formation and replaces the new middles. Any other choice (including
 * nobody) is left alone. Unchanged (same object) for a locked set or when nothing changes.
 */
export function changeFormation(
  set: SetLineup,
  change: Partial<Pick<Formation, 'system' | 'order'>>,
  players: readonly Player[],
): SetLineup {
  const next = setFormation(set, change);
  if (next === set) return set;
  const oldMiddles = startersWithRoles(set, players, ['MB']);
  const replacedMiddles =
    oldMiddles.length > 0 &&
    oldMiddles.length === set.liberoReplaces.length &&
    oldMiddles.every((id) => set.liberoReplaces.includes(id));
  if (!replacedMiddles) return next;
  return { ...next, liberoReplaces: startersWithRoles(next, players, ['MB']) };
}
