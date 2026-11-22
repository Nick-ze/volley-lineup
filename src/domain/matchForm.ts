/**
 * v7.0: the new-match form (docs/PLAN.md §28.3). A match goes into a season of its team and
 * plays one of that season's opponents: an existing one (a chip, or a typed name that matches
 * one ignoring case and accents) or a new name, which is added to the season. Without any
 * season, a new one is named in the form. Pure: errors are codes, nothing is stored here.
 */
import type { FieldErrorCode } from './roster';
import { isValidIsoDate } from './roster';
import {
  findOpponentByName,
  foldName,
  validateOpponentName,
  validateSeasonForm,
  type OpponentNameError,
  type SeasonFormError,
} from './seasons';
import type { Opponent, Season } from './types';

export interface NewMatchInput {
  /** The chosen season, or null when the team has none (then `newSeasonName` is used). */
  seasonId: string | null;
  newSeasonName: string;
  /** The chosen opponent chip, if any. A typed name wins over it. */
  opponentId: string | null;
  opponentName: string;
  date: string;
  home: boolean;
}

export interface NewMatchContext {
  teamId: string;
  seasons: readonly Season[];
  opponents: readonly Opponent[];
}

export type Ref = { kind: 'existing'; id: string } | { kind: 'new'; name: string };

export interface NewMatchValue {
  season: Ref;
  opponent: Ref;
  date: string;
  home: boolean;
}

export type NewMatchField = 'season' | 'opponent' | 'date';
export type NewMatchErrors = Partial<Record<NewMatchField, FieldErrorCode>>;

export type NewMatchResult =
  | { ok: true; value: NewMatchValue; errors: NewMatchErrors }
  | { ok: false; errors: NewMatchErrors };

const CODES: Record<SeasonFormError | OpponentNameError, FieldErrorCode> = {
  REQUIRED: 'required',
  TOO_LONG: 'tooLong',
  DUPLICATE: 'duplicate',
  INVALID_DATE: 'invalidDate',
  END_BEFORE_START: 'invalidDate',
};

/** The opponent a typed name stands for: the season's opponent of that name, if any. */
export function matchingOpponent(
  opponents: readonly Opponent[],
  seasonId: string | null,
  name: string,
): Opponent | undefined {
  if (seasonId === null || foldName(name) === '') return undefined;
  return findOpponentByName(opponents, seasonId, name);
}

function seasonRef(input: NewMatchInput, ctx: NewMatchContext): Ref | FieldErrorCode {
  const chosen = ctx.seasons.find((s) => s.id === input.seasonId && s.teamId === ctx.teamId);
  if (chosen) return { kind: 'existing', id: chosen.id };
  if (ctx.seasons.some((s) => s.teamId === ctx.teamId)) return 'required';
  const result = validateSeasonForm(
    { name: input.newSeasonName, kind: 'season', startDate: '', endDate: '', location: '' },
    ctx.seasons,
    ctx.teamId,
  );
  // Only the name is filled in, so only a name error is possible.
  return result.ok
    ? { kind: 'new', name: result.value.name }
    : CODES[result.errors.name as SeasonFormError];
}

function opponentRef(
  input: NewMatchInput,
  ctx: NewMatchContext,
  seasonId: string | null,
): Ref | FieldErrorCode {
  const typed = matchingOpponent(ctx.opponents, seasonId, input.opponentName);
  if (typed) return { kind: 'existing', id: typed.id };
  if (input.opponentName.trim() === '') {
    const chip = ctx.opponents.find((o) => o.id === input.opponentId && o.seasonId === seasonId);
    return chip ? { kind: 'existing', id: chip.id } : 'required';
  }
  // A name that matched no opponent of the season is new (so never a duplicate here).
  const result = validateOpponentName(input.opponentName, [], seasonId ?? '');
  return result.ok ? { kind: 'new', name: result.name } : CODES[result.error];
}

/** Validates the new-match form; see the file comment. */
export function validateNewMatch(input: NewMatchInput, ctx: NewMatchContext): NewMatchResult {
  const errors: NewMatchErrors = {};
  const season = seasonRef(input, ctx);
  if (typeof season === 'string') errors.season = season;
  const seasonId = typeof season !== 'string' && season.kind === 'existing' ? season.id : null;
  const opponent = opponentRef(input, ctx, seasonId);
  if (typeof opponent === 'string') errors.opponent = opponent;
  const date = input.date.trim();
  if (!isValidIsoDate(date)) errors.date = 'invalidDate';
  if (typeof season === 'string' || typeof opponent === 'string' || errors.date) {
    return { ok: false, errors };
  }
  return { ok: true, value: { season, opponent, date, home: input.home }, errors };
}
