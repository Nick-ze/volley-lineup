import { useShallow } from 'zustand/react/shallow';

import type { Match, Player, Team } from '@/domain/types';

import { useAppStore } from './appStore';
import { selectMatchesForTeam, selectPlayersForTeam, selectTeamsForProfile } from './selectors';

/*
 * Zustand v5: selectors that build new arrays must be wrapped in useShallow,
 * otherwise React re-renders forever. Use these hooks instead of inline filters.
 */

export const useTeamsForProfile = (profileId: string | null | undefined): Team[] =>
  useAppStore(useShallow((s) => (profileId ? selectTeamsForProfile(s, profileId) : [])));

export const usePlayersForTeam = (teamId: string | null | undefined): Player[] =>
  useAppStore(useShallow((s) => (teamId ? selectPlayersForTeam(s, teamId) : [])));

export const useMatchesForTeam = (teamId: string | null | undefined): Match[] =>
  useAppStore(useShallow((s) => (teamId ? selectMatchesForTeam(s, teamId) : [])));

export const useTeam = (id: string | null | undefined): Team | undefined =>
  useAppStore((s) => s.teams.find((t) => t.id === id));

export const useMatch = (id: string | null | undefined): Match | undefined =>
  useAppStore((s) => s.matches.find((m) => m.id === id));

export const usePlayer = (id: string | null | undefined): Player | undefined =>
  useAppStore((s) => s.players.find((p) => p.id === id));
