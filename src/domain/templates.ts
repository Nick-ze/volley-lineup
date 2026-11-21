/**
 * 5-1 / 6-2 templates (docs/PLAN.md §11.2, §22): fill the starting six from the roster into the
 * set's formation (v6). Pure functions, no React, no storage.
 *
 * The template sets the formation's system (keeping its order and where the setter stands) and
 * fills every spot with a player for that spot's role (`spotRole`): S, OH, MB, OPP. On a 6-2
 * hitter spot an opposite is accepted after the outside hitters.
 *
 * Players are picked in passes: first by primary position (preferred role, then fallback roles),
 * then by secondary positions. Within a pass, lower jersey numbers go first and positions are
 * filled in order 1–6. Only active players are used, never twice, never the set's libero and
 * never a player whose primary position is libero.
 */
import { emptySetLineup } from './lineup';
import { spotRole, startersWithRoles } from './roles';
import {
  COURT_POSITIONS,
  type CourtPosition,
  type FormationSystem,
  type Player,
  type Position,
  type SetLineup,
  type SetNumber,
} from './types';

export type TemplateSystem = FormationSystem;

export const TEMPLATE_SYSTEMS: readonly TemplateSystem[] = ['5-1', '6-2'] as const;

/** Positions accepted for a spot's role, most preferred first. */
export function acceptedFor(system: TemplateSystem, role: Position): readonly Position[] {
  if (system === '6-2' && role === 'OH') return ['OH', 'OPP'];
  return [role];
}

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
 * Fills the six slots from the roster into the set's formation with the given system. Keeps the
 * current libero, serve choice, libero switch, formation order / setter spot and event log;
 * whom the libero replaces is reset to the new middles.
 */
export function fillFromTemplate(
  system: TemplateSystem,
  players: readonly Player[],
  setNumber: SetNumber,
  current?: SetLineup,
): TemplateResult {
  const base = current ?? emptySetLineup(setNumber);
  const formation = { ...base.formation, system };
  const pool = players
    .filter((p) => p.active && p.id !== base.liberoId && p.positions[0] !== 'L')
    .sort((a, b) => a.number - b.number);
  const used = new Set<string>();
  const slots: SetLineup['slots'] = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  const accepted = (position: CourtPosition) => acceptedFor(system, spotRole(formation, position));

  for (const pass of PASSES) {
    for (const position of COURT_POSITIONS) {
      if (slots[position] !== null) continue;
      const pick = pool.find((p) => !used.has(p.id) && pass(p, accepted(position)));
      if (pick) {
        slots[position] = pick.id;
        used.add(pick.id);
      }
    }
  }

  const missingSlots = COURT_POSITIONS.filter((p) => slots[p] === null).map((position) => ({
    position,
    role: spotRole(formation, position),
  }));
  const filled: SetLineup = { ...base, setNumber, slots, formation };
  // The libero replaces the middles (#62, by role).
  const set: SetLineup = { ...filled, liberoReplaces: startersWithRoles(filled, players, ['MB']) };
  return { set, missing: missingSlots.map((m) => m.role), missingSlots };
}
