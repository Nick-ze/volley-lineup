/**
 * Roster domain helpers: form validation for profiles, teams and players, plus small pure
 * helpers (jersey uniqueness and duplicates, position ordering). The match form lives in
 * `matchForm.ts`.
 *
 * Validation returns error **codes**, never user-facing text; the UI maps codes to strings.
 * Plain checks, no zod (v8.3: zod is only used by the export file format).
 */
import type { Player, Position, Team } from './types';

export const NAME_MAX_LENGTH = 40;
export const SEASON_MAX_LENGTH = 20;
export const JERSEY_MIN = 0;
export const JERSEY_MAX = 99;

export type FieldErrorCode =
  'required' | 'tooLong' | 'notInteger' | 'outOfRange' | 'taken' | 'invalidDate' | 'duplicate';

export type FormErrors<K extends string> = Partial<Record<K, FieldErrorCode>>;

export type FormResult<T, K extends string> =
  { ok: true; value: T; errors: FormErrors<K> } | { ok: false; errors: FormErrors<K> };

/* ---------- small helpers ---------- */

/** True when another player of `teamId` (other than `exceptPlayerId`) wears `number`. */
export function isJerseyNumberTaken(
  players: readonly Player[],
  teamId: string,
  number: number,
  exceptPlayerId?: string,
): boolean {
  return players.some((p) => p.teamId === teamId && p.number === number && p.id !== exceptPlayerId);
}

/**
 * The jersey numbers that two or more of `players` wear, ascending, each once (empty when no
 * number is used twice). Pass the players of ONE team.
 *
 * v10 (audit H6): the player form refuses a taken number, but two devices can each add the same
 * number before they sync. Both players stay, and a backup file of that team is refused on
 * import (`exportConsistency.ts`), so the roster and the export warn about it.
 */
export function duplicateNumbers(players: readonly Pick<Player, 'number'>[]): number[] {
  const seen = new Set<number>();
  const twice = new Set<number>();
  for (const { number } of players) (seen.has(number) ? twice : seen).add(number);
  return [...twice].sort((a, b) => a - b);
}

/** A team in which players share a jersey number, with those numbers (ascending). */
export interface TeamDuplicateNumbers {
  /** The team's name. */
  name: string;
  numbers: number[];
}

/** The teams whose players share a jersey number (`duplicateNumbers`), in the order of `teams`. */
export function teamsWithDuplicateNumbers(
  teams: readonly Pick<Team, 'id' | 'name'>[],
  players: readonly Pick<Player, 'teamId' | 'number'>[],
): TeamDuplicateNumbers[] {
  return teams
    .map((team) => ({
      name: team.name,
      numbers: duplicateNumbers(players.filter((p) => p.teamId === team.id)),
    }))
    .filter((team) => team.numbers.length > 0);
}

/** Adds the position at the end (first added = primary) or removes it if present. */
export function togglePosition(positions: readonly Position[], position: Position): Position[] {
  return positions.includes(position)
    ? positions.filter((p) => p !== position)
    : [...positions, position];
}

/** Moves `position` to the front (primary). Adds it if missing. */
export function makePrimaryPosition(
  positions: readonly Position[],
  position: Position,
): Position[] {
  return [position, ...positions.filter((p) => p !== position)];
}

/* ---------- checks ---------- */

/**
 * A trimmed text's error: `required` when blank (if it is required), `tooLong` over `max`
 * characters (Unicode code points, so an emoji counts once).
 */
function textError(text: string, max: number, required = true): FieldErrorCode | undefined {
  if (required && text === '') return 'required';
  return [...text].length > max ? 'tooLong' : undefined;
}

/** The failing fields only (an error object lists no field without an error). */
function errorsOf<K extends string>(
  checks: readonly (readonly [K, FieldErrorCode | undefined])[],
): FormErrors<K> {
  const errors: FormErrors<K> = {};
  for (const [field, code] of checks) if (code !== undefined) errors[field] = code;
  return errors;
}

function result<T, K extends string>(value: T, errors: FormErrors<K>): FormResult<T, K> {
  return Object.keys(errors).length === 0 ? { ok: true, value, errors } : { ok: false, errors };
}

/* ---------- profile ---------- */

export interface ProfileFormInput {
  name: string;
  color: string;
}
export type ProfileFormField = keyof ProfileFormInput;

export function validateProfileForm(
  input: ProfileFormInput,
): FormResult<ProfileFormInput, ProfileFormField> {
  const value = { name: input.name.trim(), color: input.color };
  const errors = errorsOf<ProfileFormField>([
    ['name', textError(value.name, NAME_MAX_LENGTH)],
    ['color', value.color === '' ? 'required' : undefined],
  ]);
  return result(value, errors);
}

/* ---------- team ---------- */

export interface TeamFormInput {
  name: string;
  season: string;
}
export interface TeamFormValue {
  name: string;
  season?: string;
}
export type TeamFormField = keyof TeamFormInput;

export function validateTeamForm(input: TeamFormInput): FormResult<TeamFormValue, TeamFormField> {
  const name = input.name.trim();
  const season = input.season.trim();
  const errors = errorsOf<TeamFormField>([
    ['name', textError(name, NAME_MAX_LENGTH)],
    ['season', textError(season, SEASON_MAX_LENGTH, false)],
  ]);
  return result({ name, season: season === '' ? undefined : season }, errors);
}

/* ---------- player ---------- */

export interface PlayerFormInput {
  firstName: string;
  lastName: string;
  /** Raw text from the input. */
  number: string;
  positions: Position[];
  active: boolean;
}
export type PlayerFormValue = Omit<Player, 'id' | 'teamId'>;
export type PlayerFormField = keyof PlayerFormInput;

export interface PlayerFormContext {
  players: readonly Player[];
  teamId: string;
  /** The player being edited (excluded from the uniqueness check). */
  playerId?: string;
}

/** The jersey number's first error, checked in this order, or undefined when it is fine. */
function numberError(text: string, ctx: PlayerFormContext): FieldErrorCode | undefined {
  if (text === '') return 'required';
  if (!/^-?\d+$/.test(text)) return 'notInteger';
  const number = Number(text);
  if (number < JERSEY_MIN || number > JERSEY_MAX) return 'outOfRange';
  return isJerseyNumberTaken(ctx.players, ctx.teamId, number, ctx.playerId) ? 'taken' : undefined;
}

/** Positions: at least one, none twice. */
function positionsError(positions: readonly Position[]): FieldErrorCode | undefined {
  if (positions.length === 0) return 'required';
  return new Set(positions).size === positions.length ? undefined : 'duplicate';
}

export function validatePlayerForm(
  input: PlayerFormInput,
  ctx: PlayerFormContext,
): FormResult<PlayerFormValue, PlayerFormField> {
  const number = input.number.trim();
  const value: PlayerFormValue = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    number: Number(number),
    positions: [...input.positions],
    active: input.active,
  };
  const errors = errorsOf<PlayerFormField>([
    ['firstName', textError(value.firstName, NAME_MAX_LENGTH)],
    ['lastName', textError(value.lastName, NAME_MAX_LENGTH)],
    ['number', numberError(number, ctx)],
    ['positions', positionsError(value.positions)],
  ]);
  return result(value, errors);
}
