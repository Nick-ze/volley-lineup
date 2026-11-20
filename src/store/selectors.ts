import type { ManagerProfile, Match, Player, Team } from '@/domain/types';

import type { AppState } from './types';

export const selectCurrentProfile = (s: AppState): ManagerProfile | undefined =>
  s.profiles.find((p) => p.id === s.currentProfileId);

export const selectTeamsForProfile = (s: AppState, profileId: string): Team[] =>
  s.teams.filter((t) => t.profileId === profileId);

export const selectPlayersForTeam = (s: AppState, teamId: string): Player[] =>
  s.players.filter((p) => p.teamId === teamId).sort((a, b) => a.number - b.number);

export const selectMatchesForTeam = (s: AppState, teamId: string): Match[] =>
  s.matches.filter((m) => m.teamId === teamId).sort((a, b) => b.date.localeCompare(a.date));
