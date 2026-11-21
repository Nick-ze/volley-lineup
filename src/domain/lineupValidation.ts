/**
 * Lineup validation. The exported types and signature are the contract the lineup builder
 * builds against; do not change them without the orchestrator.
 *
 * Domain code returns codes, never user-facing text: the UI maps `code` to a string in
 * `src/i18n/en/*.ts`.
 *
 * Rules:
 * - Errors (block `valid`):
 *   - INCOMPLETE: one issue listing every empty slot position.
 *   - DUPLICATE_PLAYER: one issue per player id placed in 2+ slots (positions = those slots).
 *   - LIBERO_ON_COURT: the libero id is also in a starting slot (positions = those slots).
 *   - UNKNOWN_PLAYER: one issue per slot / the libero referencing an id not in `players`
 *     (libero issue has no positions).
 * - Warnings (never block):
 *   - NO_SETTER: at least one slot is filled and no player on the formation's setter spot(s)
 *     has 'S' in any position. (An empty lineup only gets INCOMPLETE, so a fresh set isn't noisy.)
 *   - (UNUSUAL_LAYOUT is no longer raised since v6: the formation keeps the pairs opposite.)
 *   - INACTIVE_PLAYER: one issue per inactive player in a slot or the libero slot.
 *   - LIBERO_NOT_LIBERO: the libero is a known player without 'L' in positions.
 */
import { spotRole } from './roles';
import { COURT_POSITIONS, type CourtPosition, type Player, type SetLineup } from './types';

export type ValidationErrorCode =
  | 'INCOMPLETE' // fewer than 6 players on court
  | 'DUPLICATE_PLAYER' // same player in more than one slot
  | 'LIBERO_ON_COURT' // the set's libero is also in one of the 6 starting slots
  | 'UNKNOWN_PLAYER'; // slot / libero references a player id not in `players`

export type ValidationWarningCode =
  | 'NO_SETTER' // no starter has 'S' as any position
  | 'UNUSUAL_LAYOUT' // not raised since v6 (formations keep pairs opposite); kept for the UI map
  | 'INACTIVE_PLAYER' // an inactive/injured player is in the lineup
  | 'LIBERO_NOT_LIBERO'; // the libero slot holds a player without 'L' in positions

export interface ValidationIssue<C extends string> {
  code: C;
  /** Court positions involved, if any (for highlighting slots). */
  positions?: CourtPosition[];
  /** Player involved, if any. */
  playerId?: string;
}

export interface ValidationResult {
  /** True when there are no errors (warnings never block). */
  valid: boolean;
  errors: ValidationIssue<ValidationErrorCode>[];
  warnings: ValidationIssue<ValidationWarningCode>[];
}

type ErrorIssue = ValidationIssue<ValidationErrorCode>;
type WarningIssue = ValidationIssue<ValidationWarningCode>;

/** Player id → the slot positions it occupies (in position order). */
export function positionsByPlayer(set: SetLineup): Map<string, CourtPosition[]> {
  const map = new Map<string, CourtPosition[]>();
  for (const position of COURT_POSITIONS) {
    const id = set.slots[position];
    if (id === null) continue;
    map.set(id, [...(map.get(id) ?? []), position]);
  }
  return map;
}

export function validateLineup(set: SetLineup, players: Player[]): ValidationResult {
  const byId = new Map(players.map((p) => [p.id, p]));
  const placed = positionsByPlayer(set);
  const errors: ErrorIssue[] = [];
  const warnings: WarningIssue[] = [];

  const empty = COURT_POSITIONS.filter((p) => set.slots[p] === null);
  if (empty.length > 0) errors.push({ code: 'INCOMPLETE', positions: empty });

  for (const [playerId, positions] of placed) {
    if (positions.length > 1) errors.push({ code: 'DUPLICATE_PLAYER', positions, playerId });
  }

  const libero = set.liberoId;
  const liberoSlots = libero === null ? undefined : placed.get(libero);
  if (libero !== null && liberoSlots) {
    errors.push({ code: 'LIBERO_ON_COURT', positions: liberoSlots, playerId: libero });
  }

  for (const position of COURT_POSITIONS) {
    const id = set.slots[position];
    if (id !== null && !byId.has(id)) {
      errors.push({ code: 'UNKNOWN_PLAYER', positions: [position], playerId: id });
    }
  }
  if (libero !== null && !byId.has(libero)) {
    errors.push({ code: 'UNKNOWN_PLAYER', playerId: libero });
  }

  const starters = [...placed.keys()].flatMap((id) => byId.get(id) ?? []);
  // v6: the setter spot(s) of the formation need a player listed as setter.
  const onSetterSpots = COURT_POSITIONS.filter((p) => spotRole(set.formation, p) === 'S').flatMap(
    (p) => byId.get(set.slots[p] ?? '') ?? [],
  );
  if (placed.size > 0 && !onSetterSpots.some((p) => p.positions.includes('S'))) {
    warnings.push({ code: 'NO_SETTER' });
  }

  for (const p of starters) {
    if (!p.active)
      warnings.push({ code: 'INACTIVE_PLAYER', positions: placed.get(p.id), playerId: p.id });
  }
  const liberoPlayer = libero === null ? undefined : byId.get(libero);
  if (liberoPlayer && !liberoSlots && !liberoPlayer.active) {
    warnings.push({ code: 'INACTIVE_PLAYER', playerId: liberoPlayer.id });
  }
  if (liberoPlayer && !liberoPlayer.positions.includes('L')) {
    warnings.push({ code: 'LIBERO_NOT_LIBERO', playerId: liberoPlayer.id });
  }

  return { valid: errors.length === 0, errors, warnings };
}
