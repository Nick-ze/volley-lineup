import { formatOptionalDate } from '@/domain/dates';
import type {
  HostedSettings,
  HostedTeamNameError,
  SettingsBlock,
  TournamentFormError,
} from '@/domain/hostedTournament';
import type { HostedTournament } from '@/domain/types';
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
