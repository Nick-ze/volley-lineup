import { namedPresetsFor, startersFor } from '@/domain/presets';
import type { LineupPreset, ManagerProfile, Match, Player, Team } from '@/domain/types';

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

export const selectStarters = (s: AppState, teamId: string): LineupPreset | undefined =>
  startersFor(s.presets, teamId);
