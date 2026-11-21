/**
 * 5-1 / 6-2 system templates (docs/PLAN.md §11.2). Pure functions, no React, no storage.
 *
 * Layouts (rotation 1, setter at position 1 serving; opposite pairs are 1↔4, 2↔5, 3↔6):
 * - 5-1: S 1 · OH 2 · MB 3 · OPP 4 · OH 5 · MB 6 (setter opposite the opposite, outsides
 *   opposite, middles opposite).
 * - 6-2: S 1 · OH 2 · MB 3 · S 4 · OH 5 · MB 6 (two setters opposite; the hitter spots take an
 *   outside hitter, else an opposite).
 *
 * Players are picked in passes: first by primary position (preferred role, then fallback roles),
 * then by secondary positions. Within a pass, lower jersey numbers go first and positions are
 * filled in order 1–6. Only active players are used, never twice, never the set's libero and
 * never a player whose primary position is libero.
 *
 * Roles (v4): every filled spot plays the template's role for it (the first accepted position,
 * e.g. an opposite on a 6-2 hitter spot plays OH); an override is stored only where that differs
 * from the player's primary position. No confirmation — the court still marks off-position roles.
 */
import { emptySetLineup } from './lineup';
import { primaryPosition, startersWithRoles } from './roles';
import {
  COURT_POSITIONS,
  type CourtPosition,
  type Player,
  type Position,
  type RoleOverrides,
  type SetLineup,
  type SetNumber,
} from './types';

export type TemplateSystem = '5-1' | '6-2';

export const TEMPLATE_SYSTEMS: readonly TemplateSystem[] = ['5-1', '6-2'] as const;

/** Accepted positions per court position, most preferred first. */
export type TemplateLayout = Record<CourtPosition, readonly Position[]>;

export const TEMPLATE_LAYOUTS: Record<TemplateSystem, TemplateLayout> = {
  '5-1': { 1: ['S'], 2: ['OH'], 3: ['MB'], 4: ['OPP'], 5: ['OH'], 6: ['MB'] },
  '6-2': { 1: ['S'], 2: ['OH', 'OPP'], 3: ['MB'], 4: ['S'], 5: ['OH', 'OPP'], 6: ['MB'] },
};

/** A court position the template could not fill and the position (role) it needed. */
export interface MissingSlot {
  position: CourtPosition;
  role: Position;
}

export interface TemplateResult {
  set: SetLineup;
  /** Roles that could not be filled, in court-position order (e.g. ['MB']). */
  missing: Position[];
  /** The same, with the court position each one was meant for. */
  missingSlots: MissingSlot[];
}

type Pass = (player: Player, roles: readonly Position[]) => boolean;

/** Primary matches the preferred role → primary matches a fallback role → any secondary. */
const PASSES: readonly Pass[] = [
  (p, roles) => p.positions[0] === roles[0],
  (p, roles) => roles.slice(1).includes(p.positions[0]),
  (p, roles) => p.positions.slice(1).some((pos) => roles.includes(pos)),
];

/**
 * Fills the six slots from the roster using a 5-1 or 6-2 layout. Keeps the current libero, serve
 * choice, libero switch and event log; roles follow the template and whom the libero replaces is
 * reset to the new middles.
 */
export function fillFromTemplate(
  system: TemplateSystem,
  players: readonly Player[],
  setNumber: SetNumber,
  current?: SetLineup,
): TemplateResult {
  const base = current ?? emptySetLineup(setNumber);
  const layout = TEMPLATE_LAYOUTS[system];
  const pool = players
    .filter((p) => p.active && p.id !== base.liberoId && p.positions[0] !== 'L')
    .sort((a, b) => a.number - b.number);
  const used = new Set<string>();
  const slots: SetLineup['slots'] = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };

  for (const pass of PASSES) {
    for (const position of COURT_POSITIONS) {
      if (slots[position] !== null) continue;
      const pick = pool.find((p) => !used.has(p.id) && pass(p, layout[position]));
      if (pick) {
        slots[position] = pick.id;
        used.add(pick.id);
      }
    }
  }

  const missingSlots = COURT_POSITIONS.filter((p) => slots[p] === null).map((position) => ({
    position,
    role: layout[position][0],
  }));
  const byId = new Map(pool.map((p) => [p.id, p]));
  const roles: RoleOverrides = {};
  for (const position of COURT_POSITIONS) {
    const player = byId.get(slots[position] ?? '');
    const role = layout[position][0];
    if (player && primaryPosition(player) !== role) roles[player.id] = role;
  }
  const filled: SetLineup = { ...base, setNumber, slots, roles };
  // The libero replaces the template's middles (#62, by role since v4).
  const set: SetLineup = { ...filled, liberoReplaces: startersWithRoles(filled, players, ['MB']) };
  return { set, missing: missingSlots.map((m) => m.role), missingSlots };
}
