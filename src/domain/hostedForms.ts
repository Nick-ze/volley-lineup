/**
 * v12 hosted tournaments: validation of the tournament form and of team names, and the check
 * that a change of the settings leaves every stored result valid. Error codes only, no
 * user-facing text.
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import { parseDateInput } from './dates';
import { MAX_HOSTED_TEAMS, MAX_MANUAL_MATCHES, teamsOfTournament } from './hostedPlan';
import { matchEndFor, resultValidity, type HostedSettings, type ResultError } from './hostedResult';
import { tournamentPlan, type PlanMatch, type PlanSource } from './hostedStandings';
import { foldName, MAX_LOCATION_LENGTH, MAX_SEASON_NAME_LENGTH } from './seasonNames';
import { MAX_NAME_LENGTH } from './syncSchema';
import type {
  HostedPlanKind,
  HostedResult,
  HostedTeam,
  HostedTournament,
  MatchEnd,
  SetsPerMatch,
} from './types';

export const MAX_TOURNAMENT_NAME_LENGTH = MAX_SEASON_NAME_LENGTH;
export const MAX_HOSTED_TEAM_NAME_LENGTH = MAX_NAME_LENGTH;
export const DEFAULT_SETS_PER_MATCH: SetsPerMatch = 3;
export const DEFAULT_MATCH_END: MatchEnd = 'bestOf';
export const DEFAULT_PLAN_KIND: HostedPlanKind = 'roundRobin';

export interface TournamentFormInput {
  name: string;
  date: string;
  location: string;
  setsPerMatch: SetsPerMatch;
  matchEnd: MatchEnd;
  plan: HostedPlanKind;
}

/** What the form stores: everything of a tournament except its ids and creation time. */
export type TournamentFormValue = Pick<
  HostedTournament,
  'name' | 'date' | 'location' | 'setsPerMatch' | 'matchEnd' | 'plan'
>;

export type TournamentFormField = 'name' | 'date' | 'location';
export type TournamentFormError = 'REQUIRED' | 'TOO_LONG' | 'DUPLICATE' | 'INVALID_DATE';

export type TournamentFormResult =
  | { ok: true; value: TournamentFormValue }
  | { ok: false; errors: Partial<Record<TournamentFormField, TournamentFormError>> };

/** The empty form of a new tournament: 3 sets, best of 3, the app makes the plan. */
export const emptyTournamentForm = (): TournamentFormInput => ({
  name: '',
  date: '',
  location: '',
  setsPerMatch: DEFAULT_SETS_PER_MATCH,
  matchEnd: DEFAULT_MATCH_END,
  plan: DEFAULT_PLAN_KIND,
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
      plan: input.plan,
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
  tournament: Pick<PlanSource, 'id' | 'plan'>,
  next: HostedSettings,
  teams: readonly HostedTeam[],
  results: readonly HostedResult[],
): SettingsBlock | null {
  const plan = tournamentPlan({ ...tournament, ...next }, teams, results);
  for (const match of plan.rounds.flatMap((r) => r.matches)) {
    if (match.result === undefined) continue;
    const validity = resultValidity(match.sets, next);
    if (!validity.ok && validity.error !== 'EMPTY') return { match, error: validity.error };
  }
  return null;
}

/**
 * v12.1: who makes the plan can only be changed while the tournament has nothing stored — no
 * result (round robin) and no match (own matches). A round robin's results are one per pair and
 * never empty; own matches may repeat a pair and may have no result, so neither turns into the
 * other without loss.
 */
export function planKindLocked(tournamentId: string, results: readonly HostedResult[]): boolean {
  return results.some((r) => r.tournamentId === tournamentId);
}

export type AddMatchError = 'SAME_TEAM' | 'UNKNOWN_TEAM' | 'TOO_MANY' | 'NOT_MANUAL';

/**
 * v12.1: whether the coach can add a match between these two teams: the tournament has own
 * matches, both are different teams of it, and it has fewer than `MAX_MANUAL_MATCHES`. The same
 * pair may meet again.
 */
export function addMatchError(
  tournament: Pick<HostedTournament, 'id' | 'plan'>,
  teamAId: string,
  teamBId: string,
  teams: readonly HostedTeam[],
  results: readonly HostedResult[],
): AddMatchError | null {
  if (tournament.plan !== 'manual') return 'NOT_MANUAL';
  const own = new Set(teamsOfTournament(teams, tournament.id).map((t) => t.id));
  if (!own.has(teamAId) || !own.has(teamBId)) return 'UNKNOWN_TEAM';
  if (teamAId === teamBId) return 'SAME_TEAM';
  const count = results.filter((r) => r.tournamentId === tournament.id).length;
  return count >= MAX_MANUAL_MATCHES ? 'TOO_MANY' : null;
}
