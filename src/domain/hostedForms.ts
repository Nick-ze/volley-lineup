/**
 * v12 hosted tournaments: validation of the tournament form and of team names, and the check
 * that a change of the settings leaves every stored result valid. Error codes only, no
 * user-facing text.
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import { parseDateInput } from './dates';
import { MAX_HOSTED_TEAMS, teamsOfTournament } from './hostedPlan';
import { matchEndFor, resultValidity, type HostedSettings, type ResultError } from './hostedResult';
import { tournamentPlan, type PlanMatch } from './hostedStandings';
import { foldName, MAX_LOCATION_LENGTH, MAX_SEASON_NAME_LENGTH } from './seasonNames';
import { MAX_NAME_LENGTH } from './syncSchema';
import type { HostedResult, HostedTeam, HostedTournament, MatchEnd, SetsPerMatch } from './types';

export const MAX_TOURNAMENT_NAME_LENGTH = MAX_SEASON_NAME_LENGTH;
export const MAX_HOSTED_TEAM_NAME_LENGTH = MAX_NAME_LENGTH;
export const DEFAULT_SETS_PER_MATCH: SetsPerMatch = 3;
export const DEFAULT_MATCH_END: MatchEnd = 'bestOf';

export interface TournamentFormInput {
  name: string;
  date: string;
  location: string;
  setsPerMatch: SetsPerMatch;
  matchEnd: MatchEnd;
}

/** What the form stores: everything of a tournament except its ids and creation time. */
export type TournamentFormValue = Pick<
  HostedTournament,
  'name' | 'date' | 'location' | 'setsPerMatch' | 'matchEnd'
>;

export type TournamentFormField = 'name' | 'date' | 'location';
export type TournamentFormError = 'REQUIRED' | 'TOO_LONG' | 'DUPLICATE' | 'INVALID_DATE';

export type TournamentFormResult =
  | { ok: true; value: TournamentFormValue }
  | { ok: false; errors: Partial<Record<TournamentFormField, TournamentFormError>> };

/** The empty form of a new tournament: 3 sets, best of 3. */
export const emptyTournamentForm = (): TournamentFormInput => ({
  name: '',
  date: '',
  location: '',
  setsPerMatch: DEFAULT_SETS_PER_MATCH,
  matchEnd: DEFAULT_MATCH_END,
});

/**
 * Validates the tournament form: a name (≤ 40, unique within the profile ignoring case and
 * accents, except the tournament being edited), an optional date (dd.mm.yy, dd.mm.yyyy or ISO;
 * stored as ISO), an optional place (≤ 80). With 2 or 4 sets the match end is always
 * `allSets`. Blank optional fields are left out.
 */
export function validateTournamentForm(
  input: TournamentFormInput,
  tournaments: readonly HostedTournament[],
  profileId: string,
  editingId: string | null = null,
): TournamentFormResult {
  const errors: Partial<Record<TournamentFormField, TournamentFormError>> = {};
  const name = input.name.trim();
  if (name === '') errors.name = 'REQUIRED';
  else if (name.length > MAX_TOURNAMENT_NAME_LENGTH) errors.name = 'TOO_LONG';
  else if (
    tournaments.some(
      (x) => x.profileId === profileId && x.id !== editingId && foldName(x.name) === foldName(name),
    )
  ) {
    errors.name = 'DUPLICATE';
  }
  const date = input.date.trim() === '' ? '' : parseDateInput(input.date);
  if (date === null) errors.date = 'INVALID_DATE';
  const location = input.location.trim();
  if (location.length > MAX_LOCATION_LENGTH) errors.location = 'TOO_LONG';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      ...(date === '' || date === null ? {} : { date }),
      ...(location === '' ? {} : { location }),
      setsPerMatch: input.setsPerMatch,
      matchEnd: matchEndFor(input.setsPerMatch, input.matchEnd),
    },
  };
}

export type HostedTeamNameError = 'REQUIRED' | 'TOO_LONG' | 'DUPLICATE' | 'TOO_MANY';

/**
 * Validates a team name within a tournament: not blank, ≤ `MAX_HOSTED_TEAM_NAME_LENGTH`, unique
 * ignoring case and accents (except the team being renamed). A new team (no `editingId`) is
 * refused when the tournament already has 16.
 */
export function validateHostedTeamName(
  name: string,
  teams: readonly HostedTeam[],
  tournamentId: string,
  editingId: string | null = null,
): { ok: true; name: string } | { ok: false; error: HostedTeamNameError } {
  const own = teamsOfTournament(teams, tournamentId);
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return { ok: false, error: 'REQUIRED' };
  if (trimmed.length > MAX_HOSTED_TEAM_NAME_LENGTH) return { ok: false, error: 'TOO_LONG' };
  if (own.some((x) => x.id !== editingId && foldName(x.name) === foldName(trimmed))) {
    return { ok: false, error: 'DUPLICATE' };
  }
  if (editingId === null && own.length >= MAX_HOSTED_TEAMS) return { ok: false, error: 'TOO_MANY' };
  return { ok: true, name: trimmed };
}

/** A result that new settings would make invalid, with the reason. */
export interface SettingsBlock {
  match: PlanMatch;
  error: Exclude<ResultError, 'EMPTY'>;
}

/**
 * The first match (in plan order) whose stored result would be invalid under `next` — more
 * sets than the new number, or a set after the deciding one of a best-of — or null when the
 * change is fine. A change is only allowed while every stored result stays valid.
 */
export function settingsChangeBlock(
  tournamentId: string,
  next: HostedSettings,
  teams: readonly HostedTeam[],
  results: readonly HostedResult[],
): SettingsBlock | null {
  const plan = tournamentPlan({ id: tournamentId, ...next }, teams, results);
  for (const match of plan.rounds.flatMap((r) => r.matches)) {
    if (match.result === undefined) continue;
    const validity = resultValidity(match.sets, next);
    if (!validity.ok && validity.error !== 'EMPTY') return { match, error: validity.error };
  }
  return null;
}
