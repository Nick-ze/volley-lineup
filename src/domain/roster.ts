/**
 * Roster domain helpers: form validation for profiles, teams, players and matches,
 * plus small pure helpers (jersey uniqueness, position ordering, dates).
 *
 * Validation returns error **codes**, never user-facing text; the UI maps codes to strings.
 */
import { z } from 'zod';

import type { Player, Position } from './types';

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

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/* ---------- zod plumbing ---------- */

const name = z.string().trim().min(1, 'required').max(NAME_MAX_LENGTH, 'tooLong');

function run<T, K extends string>(schema: z.ZodType<T>, input: unknown): FormResult<T, K> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data, errors: {} };
  const errors: FormErrors<K> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0]) as K;
    errors[key] ??= issue.message as FieldErrorCode;
  }
  return { ok: false, errors };
}

/* ---------- profile ---------- */

export interface ProfileFormInput {
  name: string;
  color: string;
}
export type ProfileFormField = keyof ProfileFormInput;

const profileSchema = z.object({ name, color: z.string().min(1, 'required') });

export function validateProfileForm(input: ProfileFormInput) {
  return run<ProfileFormInput, ProfileFormField>(profileSchema, input);
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

const teamSchema = z.object({
  name,
  season: z
    .string()
    .trim()
    .max(SEASON_MAX_LENGTH, 'tooLong')
    .transform((s) => (s === '' ? undefined : s)),
});

export function validateTeamForm(input: TeamFormInput) {
  return run<TeamFormValue, TeamFormField>(teamSchema, input);
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

const positionSchema = z.enum(['S', 'OH', 'MB', 'OPP', 'L', 'DS']);

function playerSchema(ctx: PlayerFormContext) {
  return z.object({
    firstName: name,
    lastName: name,
    number: z
      .string()
      .trim()
      .min(1, 'required')
      .regex(/^-?\d+$/, 'notInteger')
      .transform(Number)
      .pipe(
        z
          .number()
          .min(JERSEY_MIN, 'outOfRange')
          .max(JERSEY_MAX, 'outOfRange')
          .refine((n) => !isJerseyNumberTaken(ctx.players, ctx.teamId, n, ctx.playerId), 'taken'),
      ),
    positions: z
      .array(positionSchema)
      .min(1, 'required')
      .refine((ps) => new Set(ps).size === ps.length, 'duplicate'),
    active: z.boolean(),
  });
}

export function validatePlayerForm(input: PlayerFormInput, ctx: PlayerFormContext) {
  return run<PlayerFormValue, PlayerFormField>(playerSchema(ctx), input);
}

/* ---------- match ---------- */

export interface MatchFormInput {
  opponent: string;
  date: string;
  home: boolean;
}
export type MatchFormField = keyof MatchFormInput;

const matchSchema = z.object({
  opponent: name,
  date: z.string().trim().refine(isValidIsoDate, 'invalidDate'),
  home: z.boolean(),
});

export function validateMatchForm(input: MatchFormInput) {
  return run<MatchFormInput, MatchFormField>(matchSchema, input);
}
