import { formatOptionalDate } from '@/domain/dates';
import {
  drawsPossible,
  tableCounts,
  type HostedPlayerError,
  type HostedSettings,
  type HostedTeamNameError,
  type PlanMatch,
  type SettingsBlock,
  type Standing,
  type TournamentFormError,
} from '@/domain/hostedTournament';
import type { HostedPlanKind, HostedTournament } from '@/domain/types';
import type { Strings } from '@/i18n';

/** The format in a quiet line: "best of 3" or "2 sets". */
export function formatText(t: Strings, settings: HostedSettings): string {
  const s = t.tournament.format;
  return settings.matchEnd === 'bestOf'
    ? s.bestOf(settings.setsPerMatch)
    : s.allSets(settings.setsPerMatch);
}

/** The parts under a tournament's name: date, place, format ("05.12.26 · Halle Süd · best of 3"). */
export function tournamentMetaParts(t: Strings, tournament: HostedTournament): string[] {
  return [formatOptionalDate(tournament.date), tournament.location ?? '', formatText(t, tournament)]
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** The translated text of a tournament form error (undefined = no error). */
export function tournamentErrorText(
  t: Strings,
  error: TournamentFormError | undefined,
): string | undefined {
  const s = t.tournament.errors;
  switch (error) {
    case 'REQUIRED':
      return s.required;
    case 'TOO_LONG':
      return s.tooLong;
    case 'DUPLICATE':
      return s.duplicateTournament;
    case 'INVALID_DATE':
      return s.invalidDate;
    default:
      return undefined;
  }
}

/** The translated text of a team name error (undefined = no error). */
export function teamNameErrorText(
  t: Strings,
  error: HostedTeamNameError | undefined,
  maxTeams: number,
): string | undefined {
  const s = t.tournament.errors;
  switch (error) {
    case 'REQUIRED':
      return s.required;
    case 'TOO_LONG':
      return s.tooLong;
    case 'DUPLICATE':
      return s.duplicateTeam;
    case 'TOO_MANY':
      return s.tooManyTeams(maxTeams);
    default:
      return undefined;
  }
}

/** Why new settings can't be saved: the sentence that names the match. */
export function settingsBlockText(t: Strings, block: SettingsBlock): string {
  const s = t.tournament.form.blocked;
  const { teamA, teamB, sets } = block.match;
  return block.error === 'TOO_MANY_SETS'
    ? s.TOO_MANY_SETS(teamA.name, teamB.name, sets.length)
    : s[block.error](teamA.name, teamB.name);
}

/** A team's record: "3–1", or "3–1–0" (won–drawn–lost) where a match can end in a draw. */
export function recordText(t: Strings, standing: Standing, settings: HostedSettings): string {
  const s = t.tournament.table;
  return drawsPossible(settings) || standing.drawn > 0
    ? s.recordWithDraws(standing.won, standing.drawn, standing.lost)
    : s.record(standing.won, standing.lost);
}

/** The ball difference with its sign: "+24", "−31", "0". */
export const ballDifferenceText = (t: Strings, standing: Standing): string =>
  t.tournament.signed(standing.ballsFor - standing.ballsAgainst);

/** The parts of a table row's line: "4 played", "3–1", "sets 7:3", "balls +24". */
export function standingParts(t: Strings, standing: Standing, settings: HostedSettings): string[] {
  const s = t.tournament.table;
  return [
    s.played(standing.played),
    recordText(t, standing, settings),
    s.sets(standing.setsFor, standing.setsAgainst),
    s.balls(ballDifferenceText(t, standing)),
  ];
}

/** The label under the table points: "Matches" or "Sets". */
export const pointsUnit = (t: Strings, settings: HostedSettings): string =>
  t.tournament.table.unit[tableCounts(settings)];

/** A match's label: "Round 3" in a round robin, "Match 3" in a tournament with own matches. */
export const matchLabel = (
  t: Strings,
  kind: HostedPlanKind,
  match: Pick<PlanMatch, 'round' | 'number'>,
): string =>
  kind === 'manual'
    ? t.tournament.matches.match(match.number)
    : t.tournament.matches.round(match.round);

/** The translated text of a player form error (undefined = no error). */
export function playerErrorText(
  t: Strings,
  error: HostedPlayerError | undefined,
  maxPlayers: number,
): string | undefined {
  const s = t.tournament.players.errors;
  if (error === undefined) return undefined;
  return error === 'TOO_MANY' ? s.TOO_MANY(maxPlayers) : s[error];
}
