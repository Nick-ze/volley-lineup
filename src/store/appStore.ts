import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { emptySetLineup } from '@/domain/lineup';
import type { Match, SetLineup } from '@/domain/types';
import { createId } from '@/lib/id';

import { migrateStore, STORE_VERSION } from './migrations';
import type { AppData, AppState, AppStore } from './types';

export const STORAGE_KEY = 'volley-lineup';

export const emptyData = (): AppData => ({ profiles: [], teams: [], players: [], matches: [] });

const initialState = (): AppState => ({
  ...emptyData(),
  currentProfileId: null,
  language: 'en',
  hydrated: false,
});

const now = () => new Date().toISOString();

/** Removes a player id from every slot / libero in a match. */
function removePlayerFromMatch(match: Match, playerId: string): Match {
  const sets = match.sets.map((set): SetLineup => {
    const slots = { ...set.slots };
    (Object.keys(slots) as unknown as (keyof SetLineup['slots'])[]).forEach((k) => {
      if (slots[k] === playerId) slots[k] = null;
    });
    return { ...set, slots, liberoId: set.liberoId === playerId ? null : set.liberoId };
  });
  return { ...match, sets };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
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
            currentProfileId: s.currentProfileId === id ? null : s.currentProfileId,
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
            matches: player
              ? s.matches.map((m) =>
                  m.teamId === player.teamId ? removePlayerFromMatch(m, id) : m,
                )
              : s.matches,
          };
        }),

      addMatch: (input) => {
        const { sets, ...rest } = input;
        const match: Match = { id: createId(), ...rest, sets: sets ?? [emptySetLineup(1)] };
        set((s) => ({ matches: [...s.matches, match] }));
        return match;
      },
      updateMatch: (id, patch) =>
        set((s) => ({ matches: s.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      deleteMatch: (id) => set((s) => ({ matches: s.matches.filter((m) => m.id !== id) })),
      setLineup: (matchId, lineup) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const others = m.sets.filter((x) => x.setNumber !== lineup.setNumber);
            const sets = [...others, lineup].sort((a, b) => a.setNumber - b.setNumber);
            return { ...m, sets };
          }),
        })),

      replaceAll: (data) =>
        set((s) => ({
          profiles: data.profiles,
          teams: data.teams,
          players: data.players,
          matches: data.matches,
          currentProfileId: data.profiles.some((p) => p.id === s.currentProfileId)
            ? s.currentProfileId
            : null,
        })),
      resetAll: () => set({ ...emptyData(), currentProfileId: null }),
      setHydrated: (value) => set({ hydrated: value }),
      setLanguage: (language) => set({ language }),
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
        currentProfileId: s.currentProfileId,
        language: s.language,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

/** Snapshot of the persisted data (used by export). */
export function selectAppData(s: AppData): AppData {
  return { profiles: s.profiles, teams: s.teams, players: s.players, matches: s.matches };
}
