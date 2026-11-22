import { useShallow } from 'zustand/react/shallow';

import type { LineupPreset, Match, Opponent, Player, Season, Team } from '@/domain/types';

import { useAppStore } from './appStore';
import {
  selectMatchesForSeason,
  selectMatchesForTeam,
  selectOpponentsForSeason,
  selectSeasonsForTeam,
  selectPlayersForTeam,
  selectPresetsForTeam,
  selectStarters,
  selectTeamsForProfile,
} from './selectors';

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

/** The team's named presets (not the starters), sorted by name. */
export const usePresetsForTeam = (teamId: string | null | undefined): LineupPreset[] =>
  useAppStore(useShallow((s) => (teamId ? selectPresetsForTeam(s, teamId) : [])));

/** The team's starters preset, if set. */
export const useStarters = (teamId: string | null | undefined): LineupPreset | undefined =>
  useAppStore((s) => (teamId ? selectStarters(s, teamId) : undefined));

export const usePreset = (id: string | null | undefined): LineupPreset | undefined =>
  useAppStore((s) => s.presets.find((p) => p.id === id));

/** v9: the team's seasons / tournaments, newest first. */
export const useSeasonsForTeam = (teamId: string | null | undefined): Season[] =>
  useAppStore(useShallow((s) => (teamId ? selectSeasonsForTeam(s, teamId) : [])));

export const useSeason = (id: string | null | undefined): Season | undefined =>
  useAppStore((s) => s.seasons.find((x) => x.id === id));

/** v9: a season's opponents, by name. */
export const useOpponentsForSeason = (seasonId: string | null | undefined): Opponent[] =>
  useAppStore(useShallow((s) => (seasonId ? selectOpponentsForSeason(s, seasonId) : [])));

/** v9: a season's matches, newest first. */
export const useMatchesForSeason = (seasonId: string | null | undefined): Match[] =>
  useAppStore(useShallow((s) => (seasonId ? selectMatchesForSeason(s, seasonId) : [])));
