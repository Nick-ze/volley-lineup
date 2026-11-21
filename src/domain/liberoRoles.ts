/**
 * "Libero replaces" by role (v4, docs/PLAN.md §19.5, DECISIONS #118). Pure functions.
 *
 * A role chip (e.g. "Middles") stands for the starters currently playing that role. It is "on"
 * when all of them are in `liberoReplaces`; switching it on adds them, switching it off removes
 * them. Several roles can be on at once, and single players can still be toggled on their own.
 */
import { setLiberoReplaces } from './lineupEditing';
import { startersWithRoles } from './roles';
import type { Player, Position, SetLineup } from './types';

/** The role chips in the order they are shown (middles first: the usual choice, #62). */
export const LIBERO_ROLE_GROUPS: readonly Position[] = ['MB', 'OH', 'OPP', 'S', 'DS'];

export type LiberoRoleState = 'empty' | 'on' | 'off';

/** 'empty' when no starter plays `role`, 'on' when the libero replaces all of them, else 'off'. */
export function liberoRoleState(
  set: SetLineup,
  players: readonly Player[],
  role: Position,
): LiberoRoleState {
  const ids = startersWithRoles(set, players, [role]);
  if (ids.length === 0) return 'empty';
  return ids.every((id) => set.liberoReplaces.includes(id)) ? 'on' : 'off';
}

/** Switches a role chip: 'on' → removes those starters, 'off' → adds them, 'empty' → unchanged. */
export function toggleLiberoRole(
  set: SetLineup,
  players: readonly Player[],
  role: Position,
): SetLineup {
  const ids = startersWithRoles(set, players, [role]);
  const state = liberoRoleState(set, players, role);
  if (state === 'empty') return set;
  const next =
    state === 'on'
      ? set.liberoReplaces.filter((id) => !ids.includes(id))
      : [...set.liberoReplaces, ...ids.filter((id) => !set.liberoReplaces.includes(id))];
  return setLiberoReplaces(set, next);
}
