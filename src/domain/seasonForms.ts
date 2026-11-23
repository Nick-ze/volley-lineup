/**
 * Season form and opponent name validation (error codes, no user-facing text).
 *
 * Part of the `seasons.ts` barrel: import sibling modules directly, never the barrel.
 */
import { parseDateInput } from './dates';
import {
  foldName,
  MAX_LOCATION_LENGTH,
  MAX_OPPONENT_NAME_LENGTH,
  MAX_SEASON_NAME_LENGTH,
} from './seasonNames';
import type { Opponent, Season, SeasonKind } from './types';

export interface SeasonFormInput {
  name: string;
  kind: SeasonKind;
  startDate: string;
  endDate: string;
  location: string;
}

export type SeasonFormField = 'name' | 'startDate' | 'endDate' | 'location';
export type SeasonFormError =
  'REQUIRED' | 'TOO_LONG' | 'DUPLICATE' | 'INVALID_DATE' | 'END_BEFORE_START';

export type SeasonFormResult =
  | { ok: true; value: Pick<Season, 'name' | 'kind' | 'startDate' | 'endDate' | 'location'> }
  | { ok: false; errors: Partial<Record<SeasonFormField, SeasonFormError>> };

/**
 * Validates the season form: a name (≤ 40, unique within the team ignoring case and accents,
 * except the season being edited), optional ISO dates with the end not before the start, an
 * optional place (≤ 80). Blank optional fields are left out.
 */
export function validateSeasonForm(
  input: SeasonFormInput,
  seasons: readonly Season[],
  teamId: string,
  editingId: string | null = null,
): SeasonFormResult {
  const errors: Partial<Record<SeasonFormField, SeasonFormError>> = {};
  const name = input.name.trim();
  if (name === '') errors.name = 'REQUIRED';
  else if (name.length > MAX_SEASON_NAME_LENGTH) errors.name = 'TOO_LONG';
  else if (
    seasons.some(
      (s) => s.teamId === teamId && s.id !== editingId && foldName(s.name) === foldName(name),
    )
  ) {
    errors.name = 'DUPLICATE';
  }
  // v8: dd.mm.yy, dd.mm.yyyy or ISO; stored as ISO.
  const startDate = toIso(input.startDate);
  const endDate = toIso(input.endDate);
  if (startDate === null) errors.startDate = 'INVALID_DATE';
  if (endDate === null) errors.endDate = 'INVALID_DATE';
  else if (endDate !== '' && startDate !== null && startDate !== '' && endDate < startDate) {
    errors.endDate = 'END_BEFORE_START';
  }
  const location = input.location.trim();
  if (location.length > MAX_LOCATION_LENGTH) errors.location = 'TOO_LONG';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      kind: input.kind,
      ...(startDate === '' || startDate === null ? {} : { startDate }),
      ...(endDate === '' || endDate === null ? {} : { endDate }),
      ...(location === '' ? {} : { location }),
    },
  };
}

export type OpponentNameError = 'REQUIRED' | 'TOO_LONG' | 'DUPLICATE';

/** A typed optional date as ISO: `''` when blank, `null` when invalid. */
function toIso(text: string): string | null {
  return text.trim() === '' ? '' : parseDateInput(text);
}

/** Validates an opponent name within a season (unique ignoring case / accents). */
export function validateOpponentName(
  name: string,
  opponents: readonly Opponent[],
  seasonId: string,
  editingId: string | null = null,
): { ok: true; name: string } | { ok: false; error: OpponentNameError } {
  const trimmed = name.trim();
  if (trimmed === '') return { ok: false, error: 'REQUIRED' };
  if (trimmed.length > MAX_OPPONENT_NAME_LENGTH) return { ok: false, error: 'TOO_LONG' };
  const taken = opponents.some(
    (o) => o.seasonId === seasonId && o.id !== editingId && foldName(o.name) === foldName(trimmed),
  );
  return taken ? { ok: false, error: 'DUPLICATE' } : { ok: true, name: trimmed };
}

/** The season's opponent with this name (ignoring case / accents), if any. */
export function findOpponentByName(
  opponents: readonly Opponent[],
  seasonId: string,
  name: string,
): Opponent | undefined {
  const folded = foldName(name);
  return opponents.find((o) => o.seasonId === seasonId && foldName(o.name) === folded);
}
