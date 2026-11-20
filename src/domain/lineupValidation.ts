/**
 * Lineup validation — STUB. Owned by Worker B (feat/rotation), which replaces the body
 * with the real implementation. The exported types and signature are the contract that
 * the lineup builder (Worker C) builds against; do not change them without the orchestrator.
 *
 * Domain code returns codes, never user-facing text: the UI maps `code` to a string in
 * `src/i18n/en/*.ts`.
 */
import type { CourtPosition, Player, SetLineup } from './types';

export type ValidationErrorCode =
  | 'INCOMPLETE' // fewer than 6 players on court
  | 'DUPLICATE_PLAYER' // same player in more than one slot
  | 'LIBERO_ON_COURT' // the set's libero is also in one of the 6 starting slots
  | 'UNKNOWN_PLAYER'; // slot / libero references a player id not in `players`

export type ValidationWarningCode =
  | 'NO_SETTER' // no starter has 'S' as any position
  | 'UNUSUAL_LAYOUT' // e.g. setter not opposite the opposite, two middles adjacent
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

export function validateLineup(_set: SetLineup, _players: Player[]): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}
