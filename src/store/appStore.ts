import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { chooseCaptain } from '@/domain/captain';
import { emptySetLineup } from '@/domain/lineup';
import { emptyPresetLineup, removePlayerFromPreset, startersFor } from '@/domain/presets';
import { removePlayerEverywhere } from '@/domain/playerUsage';
import { goneTeamLinks, withoutTeamLinks } from '@/domain/syncAccess';
import { withSeen } from '@/domain/tour';
import type { LineupPreset, Match, Opponent, Season, SyncData } from '@/domain/types';
import { createId } from '@/lib/id';

import { migrateStore, STORE_VERSION } from './migrations';
import type { AppData, AppState, AppStore } from './types';

export const STORAGE_KEY = 'volley-lineup';

export const emptyData = (): AppData => ({
  profiles: [],
  teams: [],
  players: [],
  matches: [],
  presets: [],
  seasons: [],
  opponents: [],
});

/** v10: no account, no shared teams (the device id is kept where it exists). */
export const emptySync = (deviceId: string | null = null): SyncData => ({
  deviceId,
  account: null,
  teams: {},
});

const initialState = (): AppState => ({
  ...emptyData(),
  currentProfileId: null,
  language: 'en',
  chipLabel: 'number',
  themeMode: 'dark',
  dyslexiaFont: false,
  tourMode: null,
  tourSeen: [],
  sync: emptySync(),
  hydrated: false,
});

const now = () => new Date().toISOString();

/** The seasons matching `drop` removed, with their opponents (their matches go with the team). */
function withoutSeasonsOf(
  s: Pick<AppData, 'seasons' | 'opponents'>,
  drop: (season: Season) => boolean,
): Pick<AppData, 'seasons' | 'opponents'> {
  const gone = new Set(s.seasons.filter(drop).map((x) => x.id));
  return {
    seasons: s.seasons.filter((x) => !gone.has(x.id)),
    opponents: s.opponents.filter((o) => !gone.has(o.seasonId)),
  };
}

/** Removes every reference to a player (court, libero, libero replacements, subs) from a match. */
function removePlayerFromMatch(match: Match, playerId: string): Match {
  return { ...match, sets: match.sets.map((set) => removePlayerEverywhere(set, playerId)) };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      addProfile: (input) => {
        const profile = { id: createId(), createdAt: now(), ...input };
        set((s) => ({ profiles: [...s.profiles, profile] }));
        return profile;
      },
      updateProfile: (id, patch) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deleteProfile: (id) =>
        set((s) => {
          const teamIds = new Set(s.teams.filter((t) => t.profileId === id).map((t) => t.id));
          return {
            profiles: s.profiles.filter((p) => p.id !== id),
            teams: s.teams.filter((t) => !teamIds.has(t.id)),
            players: s.players.filter((p) => !teamIds.has(p.teamId)),
            matches: s.matches.filter((m) => !teamIds.has(m.teamId)),
            presets: s.presets.filter((p) => !teamIds.has(p.teamId)),
            ...withoutSeasonsOf(s, (x) => teamIds.has(x.teamId)),
            currentProfileId: s.currentProfileId === id ? null : s.currentProfileId,
            // v10: the account linked to this profile is unlinked, and so are the shared teams
            // that go with the profile — in this same write (audit C1): a link left behind
            // would meet a later import of the same team and push deletions to every member.
            sync: withoutTeamLinks(
              s.sync.account?.profileId === id ? { ...s.sync, account: null } : s.sync,
              teamIds,
            ),
          };
        }),
      selectProfile: (id) => set({ currentProfileId: id }),

      addTeam: (input) => {
        const team = { id: createId(), createdAt: now(), ...input };
        set((s) => ({ teams: [...s.teams, team] }));
        return team;
      },
      updateTeam: (id, patch) =>
        set((s) => ({ teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTeam: (id) =>
        set((s) => ({
          teams: s.teams.filter((t) => t.id !== id),
          players: s.players.filter((p) => p.teamId !== id),
          matches: s.matches.filter((m) => m.teamId !== id),
          presets: s.presets.filter((p) => p.teamId !== id),
          ...withoutSeasonsOf(s, (x) => x.teamId === id),
          // v10: a shared team that leaves the device is unlinked with it (audit C1); the cloud
          // team is untouched.
          sync: withoutTeamLinks(s.sync, [id]),
        })),

      addPlayer: (input) => {
        const player = { id: createId(), ...input };
        set((s) => ({ players: [...s.players, player] }));
        return player;
      },
      updatePlayer: (id, patch) =>
        set((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePlayer: (id) =>
        set((s) => {
          const player = s.players.find((p) => p.id === id);
          return {
            players: s.players.filter((p) => p.id !== id),
            // A deleted captain leaves the team without one.
            teams: player
              ? s.teams.map((t) => (t.id === player.teamId ? chooseCaptain(t, id, false) : t))
              : s.teams,
            matches: player
              ? s.matches.map((m) =>
                  m.teamId === player.teamId ? removePlayerFromMatch(m, id) : m,
                )
              : s.matches,
            // Presets are never played, so they just lose the player.
            presets: s.presets.map((p) => removePlayerFromPreset(p, id)),
          };
        }),
      setCaptain: (teamId, playerId, on) =>
        set((s) =>
          // Only a player of that team can be its captain.
          s.players.some((p) => p.id === playerId && p.teamId === teamId)
            ? { teams: s.teams.map((t) => (t.id === teamId ? chooseCaptain(t, playerId, on) : t)) }
            : {},
        ),

      addMatch: (input) => {
        const { sets, ...rest } = input;
        const match: Match = { id: createId(), ...rest, sets: sets ?? [emptySetLineup(1)] };
        set((s) => ({ matches: [...s.matches, match] }));
        return match;
      },
      updateMatch: (id, patch) =>
        set((s) => ({ matches: s.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      deleteMatch: (id) => set((s) => ({ matches: s.matches.filter((m) => m.id !== id) })),
      addSeason: (input) => {
        const season: Season = { id: createId(), createdAt: now(), ...input };
        set((s) => ({ seasons: [...s.seasons, season] }));
        return season;
      },
      updateSeason: (id, value) =>
        set((s) => ({
          seasons: s.seasons.map((x) =>
            x.id === id ? { id: x.id, teamId: x.teamId, createdAt: x.createdAt, ...value } : x,
          ),
        })),
      deleteSeason: (id) =>
        set((s) => ({
          seasons: s.seasons.filter((x) => x.id !== id),
          opponents: s.opponents.filter((o) => o.seasonId !== id),
          matches: s.matches.filter((m) => m.seasonId !== id),
        })),
      addOpponent: (seasonId, name) => {
        const opponent: Opponent = { id: createId(), seasonId, name, createdAt: now() };
        set((s) => ({ opponents: [...s.opponents, opponent] }));
        return opponent;
      },
      renameOpponent: (id, name) =>
        set((s) => ({
          opponents: s.opponents.map((o) => (o.id === id ? { ...o, name } : o)),
          matches: s.matches.map((m) => (m.opponentId === id ? { ...m, opponent: name } : m)),
        })),
      deleteOpponent: (id) =>
        set((s) =>
          s.matches.some((m) => m.opponentId === id)
            ? {}
            : { opponents: s.opponents.filter((o) => o.id !== id) },
        ),

      setLineup: (matchId, lineup) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const others = m.sets.filter((x) => x.setNumber !== lineup.setNumber);
            const sets = [...others, lineup].sort((a, b) => a.setNumber - b.setNumber);
            return { ...m, sets };
          }),
        })),

      addPreset: (input) => {
        const { teamId, name, ...lineup } = input;
        const preset: LineupPreset = {
          id: createId(),
          teamId,
          name,
          kind: 'preset',
          ...emptyPresetLineup(),
          ...lineup,
          createdAt: now(),
        };
        set((s) => ({ presets: [...s.presets, preset] }));
        return preset;
      },
      updatePreset: (id, patch) =>
        set((s) => ({ presets: s.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
      setStarters: (teamId, lineup) => {
        const existing = startersFor(get().presets, teamId);
        const starters: LineupPreset = existing
          ? { ...existing, ...lineup }
          : { id: createId(), teamId, name: '', kind: 'starters', ...lineup, createdAt: now() };
        set((s) => ({
          presets: existing
            ? s.presets.map((p) => (p.id === existing.id ? starters : p))
            : [...s.presets, starters],
        }));
        return starters;
      },
      replaceAll: (data) =>
        set((s) => {
          // v10: keep the shared teams' bookkeeping; the account link goes with its profile, and
          // the link of a shared team that isn't in the new data goes too (audit C1).
          const sync =
            s.sync.account && !data.profiles.some((p) => p.id === s.sync.account?.profileId)
              ? { ...s.sync, account: null }
              : s.sync;
          return {
            profiles: data.profiles,
            teams: data.teams,
            players: data.players,
            matches: data.matches,
            presets: data.presets,
            seasons: data.seasons,
            opponents: data.opponents,
            currentProfileId: data.profiles.some((p) => p.id === s.currentProfileId)
              ? s.currentProfileId
              : null,
            // A link goes when its team is gone now, and when it had no team before but the new
            // data brings one under its id (a stale link, or a download that hasn't pulled
            // yet): a link must not adopt an imported team — its records would be pushed over
            // the cloud's. Downloading the team again links it with "the cloud wins".
            sync: withoutTeamLinks(sync, [
              ...goneTeamLinks(sync, data.teams),
              ...data.teams
                .map((t) => t.id)
                .filter((id) => id in sync.teams && !s.teams.some((t) => t.id === id)),
            ]),
          };
        }),
      // v10: also forgets the account and every shared team on this device (the cloud is untouched).
      resetAll: () =>
        set((s) => ({ ...emptyData(), currentProfileId: null, sync: emptySync(s.sync.deviceId) })),
      setHydrated: (value) => set({ hydrated: value }),
      syncTransaction: (fn) => set((s) => fn(s)),
      setSyncAccount: (account) => set((s) => ({ sync: { ...s.sync, account } })),
      setDeviceId: (deviceId) => set((s) => ({ sync: { ...s.sync, deviceId } })),
      setLanguage: (language) => set({ language }),
      setChipLabel: (chipLabel) => set({ chipLabel }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setDyslexiaFont: (dyslexiaFont) => set({ dyslexiaFont }),
      setTourMode: (tourMode) => set({ tourMode, tourSeen: [] }),
      markTourSeen: (page) =>
        set((s) => (s.tourSeen.includes(page) ? {} : { tourSeen: withSeen(s.tourSeen, page) })),
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: migrateStore,
      partialize: (s) => ({
        profiles: s.profiles,
        teams: s.teams,
        players: s.players,
        matches: s.matches,
        presets: s.presets,
        seasons: s.seasons,
        opponents: s.opponents,
        currentProfileId: s.currentProfileId,
        language: s.language,
        chipLabel: s.chipLabel,
        themeMode: s.themeMode,
        dyslexiaFont: s.dyslexiaFont,
        tourMode: s.tourMode,
        tourSeen: s.tourSeen,
        sync: s.sync,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

/** Snapshot of the persisted data (used by export). */
export function selectAppData(s: AppData): AppData {
  return {
    profiles: s.profiles,
    teams: s.teams,
    players: s.players,
    matches: s.matches,
    presets: s.presets,
    seasons: s.seasons,
    opponents: s.opponents,
  };
}
