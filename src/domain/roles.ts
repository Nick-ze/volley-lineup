/**
 * Roles on court (docs/PLAN.md §19–20, data model v5). Pure functions, no React, no storage.
 *
 * Every starter plays a role (S, OH, MB, OPP, DS — the court position codes). By default it is
 * the player's primary position; `SetLineup.roles` stores only the exceptions, keyed by player
 * id, so a role follows its player through swaps and rotations. Any player may play any role;
 * a role that is none of the player's positions (primary or secondary, from the roster) is
 * "off position": the UI asks to confirm it and marks the spot with an asterisk. In live play a substitute takes over the role of the player they
 * replace.
 *
 * The rotation number follows the setter: a setter at position 4 means "rotation 4". With two
 * setters (6-2) the one in the back row counts. Without a setter on court there is no setter
 * rotation (callers fall back to counting rotations from the start).
 */
import { isLineupLocked } from './lineupLock';
import {
  BACK_ROW_POSITIONS,
  rotateClockwise,
  rotateBy,
  type RotationNumber,
  type Slots,
} from './rotation';
import {
  COURT_POSITIONS,
  type CourtPosition,
  type Player,
  type Position,
  type RoleOverrides,
  type SetLineup,
} from './types';

/** Roles a starter can play (the libero has its own slot). */
export const COURT_ROLES: readonly Position[] = ['S', 'OH', 'MB', 'OPP', 'DS'];

/** A player's primary position, or null when none is set. */
export function primaryPosition(player: Pick<Player, 'positions'>): Position | null {
  return player.positions[0] ?? null;
}

/** The role a player plays given the overrides: the override, else the primary position. */
export function roleOf(
  roles: RoleOverrides,
  player: Pick<Player, 'id' | 'positions'>,
): Position | null {
  return roles[player.id] ?? primaryPosition(player);
}

/**
 * True when `role` is none of the player's positions (confirm + asterisk in the UI). Playing a
 * secondary position from the roster is not off position.
 */
export function isOffPosition(player: Pick<Player, 'positions'>, role: Position | null): boolean {
  return role !== null && !player.positions.includes(role);
}

/**
 * Sets the role a starter plays. Playing the primary position removes the override. Unchanged
 * when the player isn't on court or the set is locked (played).
 */
export function setRole(
  set: SetLineup,
  player: Pick<Player, 'id' | 'positions'>,
  role: Position,
): SetLineup {
  if (isLineupLocked(set) || !COURT_POSITIONS.some((p) => set.slots[p] === player.id)) return set;
  const roles: RoleOverrides = { ...set.roles };
  if (role === primaryPosition(player)) delete roles[player.id];
  else roles[player.id] = role;
  const same =
    Object.keys(roles).length === Object.keys(set.roles).length &&
    Object.keys(roles).every((id) => roles[id] === set.roles[id]);
  return same ? set : { ...set, roles };
}

export type RotateDirection = 'clockwise' | 'counterclockwise';

/**
 * Rotates the starting six one position before the set starts (so e.g. the setter can start at
 * any position). Roles, libero and whom the libero replaces follow the players. Unchanged for a
 * locked (played) set.
 */
export function rotateStarters(set: SetLineup, direction: RotateDirection): SetLineup {
  if (isLineupLocked(set)) return set;
  const slots = direction === 'clockwise' ? rotateClockwise(set.slots) : rotateBy(set.slots, -1);
  return { ...set, slots };
}

/** Switches the libero on or off (off = no libero swaps). Allowed in played sets, like #68. */
export function setLiberoActive(set: SetLineup, liberoActive: boolean): SetLineup {
  return set.liberoActive === liberoActive ? set : { ...set, liberoActive };
}

/** The starters (on court, in position order) whose role is one of `wanted`. */
export function startersWithRoles(
  set: SetLineup,
  players: readonly Player[],
  wanted: readonly Position[],
): string[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return COURT_POSITIONS.flatMap((position) => {
    const id = set.slots[position];
    const player = id === null ? undefined : byId.get(id);
    if (!player) return [];
    const role = roleOf(set.roles, player);
    return role !== null && wanted.includes(role) ? [player.id] : [];
  });
}

/**
 * Role of every starter on court at the start of the set (player id → role). Players without a
 * role (no positions) or unknown ids are left out.
 */
export function startingRoles(set: SetLineup, players: readonly Player[]): RoleOverrides {
  const byId = new Map(players.map((p) => [p.id, p]));
  const result: RoleOverrides = {};
  for (const position of COURT_POSITIONS) {
    const id = set.slots[position];
    const player = id === null ? undefined : byId.get(id);
    const role = player ? roleOf(set.roles, player) : null;
    if (player && role !== null) result[player.id] = role;
  }
  return result;
}

/**
 * The rotation named after the setter's position: the position of the player whose role is S;
 * with several setters, the one in the back row (lowest position first). Null without a setter.
 */
export function setterRotation(
  slots: Slots,
  roles: Readonly<RoleOverrides>,
): RotationNumber | null {
  const setters = COURT_POSITIONS.filter((p) => {
    const id = slots[p];
    return id !== null && roles[id] === 'S';
  });
  if (setters.length === 0) return null;
  const backRow = setters.find((p) => BACK_ROW_POSITIONS.includes(p));
  return (backRow ?? setters[0]) as CourtPosition as RotationNumber;
}
