import { namedPresetsFor, startersFor } from '@/domain/presets';
import { opponentsForSeason, seasonsForTeam } from '@/domain/seasons';
import type {
  LineupPreset,
  ManagerProfile,
  Match,
  Opponent,
  Player,
  Season,
  Team,
} from '@/domain/types';

import type { AppState } from './types';

export const selectCurrentProfile = (s: AppState): ManagerProfile | undefined =>
  s.profiles.find((p) => p.id === s.currentProfileId);

export const selectTeamsForProfile = (s: AppState, profileId: string): Team[] =>
  s.teams.filter((t) => t.profileId === profileId);

export const selectPlayersForTeam = (s: AppState, teamId: string): Player[] =>
  s.players.filter((p) => p.teamId === teamId).sort((a, b) => a.number - b.number);

export const selectMatchesForTeam = (s: AppState, teamId: string): Match[] =>
  s.matches.filter((m) => m.teamId === teamId).sort((a, b) => b.date.localeCompare(a.date));

/** The team's named presets (kind 'preset'), sorted by name. */
export const selectPresetsForTeam = (s: AppState, teamId: string): LineupPreset[] =>
  namedPresetsFor(s.presets, teamId);

/** v9: the team's seasons, newest first. */
export const selectSeasonsForTeam = (s: AppState, teamId: string): Season[] =>
  seasonsForTeam(s.seasons, teamId);

/** v9: a season's opponents, by name. */
export const selectOpponentsForSeason = (s: AppState, seasonId: string): Opponent[] =>
  opponentsForSeason(s.opponents, seasonId);

/** v9: a season's matches, newest first. */
export const selectMatchesForSeason = (s: AppState, seasonId: string): Match[] =>
  s.matches.filter((m) => m.seasonId === seasonId).sort((a, b) => b.date.localeCompare(a.date));

export const selectStarters = (s: AppState, teamId: string): LineupPreset | undefined =>
  startersFor(s.presets, teamId);
