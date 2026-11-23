/**
 * Roles on court (docs/PLAN.md §22–24, data model v6; volleyball background in
 * docs/VOLLEYBALL_RULES.md). Pure functions, no React, no storage.
 *
 * Roles belong to the six court spots, not to players: a set has a **formation** (5-1 or 6-2, an
 * order variant, and where the setter stands), which fixes the role of every spot so that the
 * pairs are always opposite each other (1–4, 2–5, 3–6: S–OPP or S–S, OH–OH, MB–MB). Whoever
 * stands on a spot plays its role. Rotating the starters before the set rotates the formation
 * with them; in live play the players carry their starting role (a substitute takes the role of
 * the player they replace).
 *
 * Any player may stand on any spot; a role that is none of the player's positions (primary or
 * secondary, from the roster) is "off position": the UI asks to confirm it and marks the spot
 * with an asterisk.
 *
 * The rotation number follows the setter: a setter at position 4 means "rotation 4". With two
 * setters (6-2) the one in the back row counts.
 */
import { isRecord } from './legacyData';
import { isLineupLocked } from './lineupLock';
import {
  BACK_ROW_POSITIONS,
  nextPositionClockwise,
  rotateClockwise,
  rotateBy,
  type RotationNumber,
  type Slots,
} from './rotation';
import {
  COURT_POSITIONS,
  type CourtPosition,
  type Formation,
  type FormationOrder,
  type FormationSystem,
  type Player,
  type PlayerRoles,
  type Position,
  type SetLineup,
} from './types';

export const FORMATION_SYSTEMS: readonly FormationSystem[] = ['5-1', '6-2'];
export const FORMATION_ORDERS: readonly FormationOrder[] = ['outside', 'middle'];

/**
 * Roles around the court starting at the setter and going up the position numbers
 * (setter at 1 → positions 1, 2, 3, 4, 5, 6). docs/VOLLEYBALL_RULES.md §2.
 */
export const FORMATION_PATTERNS: Record<
  FormationSystem,
  Record<FormationOrder, readonly Position[]>
> = {
  '5-1': {
    outside: ['S', 'OH', 'MB', 'OPP', 'OH', 'MB'],
    middle: ['S', 'MB', 'OH', 'OPP', 'MB', 'OH'],
  },
  '6-2': {
    outside: ['S', 'OH', 'MB', 'S', 'OH', 'MB'],
    middle: ['S', 'MB', 'OH', 'S', 'MB', 'OH'],
  },
};

/** The default formation: 5-1, setter followed by an outside, setter at position 1. */
export const DEFAULT_FORMATION: Formation = { system: '5-1', order: 'outside', setterAt: 1 };

/** The role of one court spot in a formation. */
export function spotRole(formation: Formation, position: CourtPosition): Position {
  const pattern = FORMATION_PATTERNS[formation.system][formation.order];
  return pattern[(position - formation.setterAt + 6) % 6];
}

/** The roles of all six spots. */
export function spotRoles(formation: Formation): Record<CourtPosition, Position> {
  const role = (p: CourtPosition) => spotRole(formation, p);
  return { 1: role(1), 2: role(2), 3: role(3), 4: role(4), 5: role(5), 6: role(6) };
}

/** The role a starter plays in the set: the role of their spot; null when not on court. */
export function roleOf(
  set: Pick<SetLineup, 'slots' | 'formation'>,
  playerId: string,
): Position | null {
  const position = COURT_POSITIONS.find((p) => set.slots[p] === playerId);
  return position === undefined ? null : spotRole(set.formation, position);
}

/**
 * True when `role` is none of the player's positions (confirm + asterisk in the UI). Playing a
 * secondary position from the roster is not off position.
 */
export function isOffPosition(player: Pick<Player, 'positions'>, role: Position | null): boolean {
  return role !== null && !player.positions.includes(role);
}

/**
 * Changes the formation's system and/or order, keeping the setter's spot. Going from a 6-2 to a
 * 5-1 keeps the back-row setter (the one the rotation is named after), so the setter doesn't jump
 * to the front row. Unchanged for a locked (played) set or when nothing changes.
 */
export function setFormation(
  set: SetLineup,
  change: Partial<Pick<Formation, 'system' | 'order'>>,
): SetLineup {
  if (isLineupLocked(set)) return set;
  const toFiveOne = set.formation.system === '6-2' && change.system === '5-1';
  const setterAt = toFiveOne ? formationRotation(set.formation) : set.formation.setterAt;
  const formation = { ...set.formation, ...change, setterAt };
  const same = formation.system === set.formation.system && formation.order === set.formation.order;
  return same ? set : { ...set, formation };
}

export type RotateDirection = 'clockwise' | 'counterclockwise';

/**
 * Rotates the starting six one position before the set starts (so the setter can start at any
 * position); the formation turns with the players, so everyone keeps their role. Unchanged for
 * a locked (played) set.
 */
export function rotateStarters(set: SetLineup, direction: RotateDirection): SetLineup {
  if (isLineupLocked(set)) return set;
  const clockwise = direction === 'clockwise';
  const slots = clockwise ? rotateClockwise(set.slots) : rotateBy(set.slots, -1);
  const setterAt = clockwise
    ? nextPositionClockwise(set.formation.setterAt)
    : (((set.formation.setterAt % 6) + 1) as CourtPosition);
  return { ...set, slots, formation: { ...set.formation, setterAt } };
}

/** Switches the libero on or off (off = no libero swaps). Allowed in played sets, like #68. */
export function setLiberoActive(set: SetLineup, liberoActive: boolean): SetLineup {
  return set.liberoActive === liberoActive ? set : { ...set, liberoActive };
}

/** The starters (known players on court, in position order) whose spot has one of `wanted`. */
export function startersWithRoles(
  set: SetLineup,
  players: readonly Player[],
  wanted: readonly Position[],
): string[] {
  const known = new Set(players.map((p) => p.id));
  return COURT_POSITIONS.flatMap((position) => {
    const id = set.slots[position];
    if (id === null || !known.has(id)) return [];
    return wanted.includes(spotRole(set.formation, position)) ? [id] : [];
  });
}

/** Role of every known starter on court at the start of the set (player id → spot role). */
export function startingRoles(set: SetLineup, players: readonly Player[]): PlayerRoles {
  const known = new Set(players.map((p) => p.id));
  const result: PlayerRoles = {};
  for (const position of COURT_POSITIONS) {
    const id = set.slots[position];
    if (id !== null && known.has(id)) result[id] = spotRole(set.formation, position);
  }
  return result;
}

/**
 * The rotation named after the setter's position: the position of the player whose role is S;
 * with several setters, the one in the back row (lowest position first). Null without a setter.
 */
export function setterRotation(slots: Slots, roles: Readonly<PlayerRoles>): RotationNumber | null {
  const setters = COURT_POSITIONS.filter((p) => {
    const id = slots[p];
    return id !== null && roles[id] === 'S';
  });
  if (setters.length === 0) return null;
  const backRow = setters.find((p) => BACK_ROW_POSITIONS.includes(p));
  return backRow ?? setters[0];
}

/**
 * The setter rotation of a formation itself (works on an empty court): the setter's spot; in a
 * 6-2 the back-row setter spot.
 */
export function formationRotation(formation: Formation): RotationNumber {
  const spots = COURT_POSITIONS.filter((p) => spotRole(formation, p) === 'S');
  return spots.find((p) => BACK_ROW_POSITIONS.includes(p)) ?? spots[0];
}

/**
 * Migration helper (v5 → v6 data): the formation that matches an old lineup with per-player role
 * overrides (`roles`, else primary positions). The setter is the first starter playing S; two
 * setters opposite each other make a 6-2. The order is 'middle' when the spot after the setter
 * is played by a middle, else 'outside'. Without a setter: the default formation.
 */
export function inferFormation(
  slots: Slots,
  overrides: Readonly<Record<string, string>>,
  players: readonly Pick<Player, 'id' | 'positions'>[],
): Formation {
  const byId = new Map(players.map((p) => [p.id, p]));
  const role = (position: CourtPosition): string | null => {
    const id = slots[position];
    if (id === null) return null;
    return overrides[id] ?? byId.get(id)?.positions[0] ?? null;
  };
  const setterAt = COURT_POSITIONS.find((p) => role(p) === 'S');
  if (setterAt === undefined) return { ...DEFAULT_FORMATION };
  const opposite = (((setterAt + 2) % 6) + 1) as CourtPosition;
  const system: FormationSystem = role(opposite) === 'S' ? '6-2' : '5-1';
  const next = ((setterAt % 6) + 1) as CourtPosition;
  const order: FormationOrder = role(next) === 'MB' ? 'middle' : 'outside';
  return { system, order, setterAt };
}

/**
 * Upgrades one stored lineup (set or preset) of the v5 data shape to v6: drops the per-player
 * `roles` overrides and adds the matching `formation` (`inferFormation`). Anything malformed is
 * passed through so the caller's validation reports it; a lineup that already has a formation is
 * left alone.
 */
export function upgradeLineupToFormation(lineup: unknown, players: unknown): unknown {
  if (!isRecord(lineup) || 'formation' in lineup || !isRecord(lineup.slots)) return lineup;
  const { roles, ...rest } = lineup;
  const known = Array.isArray(players)
    ? players.flatMap((p) =>
        isRecord(p) && typeof p.id === 'string' && Array.isArray(p.positions)
          ? [{ id: p.id, positions: p.positions as Position[] }]
          : [],
      )
    : [];
  const overrides: Record<string, string> = {};
  if (isRecord(roles)) {
    for (const [id, role] of Object.entries(roles))
      if (typeof role === 'string') overrides[id] = role;
  }
  const formation = inferFormation(lineup.slots as Slots, overrides, known);
  return { ...rest, formation };
}
