/**
 * v10: how the sync engine reads and writes the app's stores. Records and sync bookkeeping are
 * only written through `transaction` (one atomic `syncTransaction`), so both are persisted
 * together; the runtime store gets the status, session, holds and notices.
 */
import { replaceTeamSlice, teamSlice, type TeamData, type TeamSlice } from '@/domain/syncRecords';
import { pendingCount } from '@/domain/syncChanges';
import { nextSyncStatus, type SyncStatusEvent } from '@/domain/syncStatus';
import type { SyncData, SyncedTeam, SyncNotice } from '@/domain/types';
import {
  lastStoreWriteFailed,
  useAppStore,
  useSyncRuntime,
  type AppState,
  type AppStore,
} from '@/store';

/** A member's display name / a hold's holder name: at most this long on the server. */
const NAME_LIMIT = 60;

export const appState = (): AppStore => useAppStore.getState();

let applying = 0;

/** True while the engine itself writes the store (its own writes aren't user edits). */
export const isApplying = (): boolean => applying > 0;

/**
 * One atomic store write by the engine. Return `s` itself for "no change": then the store isn't
 * called at all (v10 audit M19) — zustand's persist rewrites the whole stored data after every
 * `set`, also when the state is the same object, which cost three full writes per idle cycle.
 * The one exception: when the last write of the data failed, "no change" still goes through the
 * store, so the next cycle repeats the write as it always did.
 */
export function transaction(fn: (s: AppState) => Partial<AppState>): void {
  applying += 1;
  try {
    const state = useAppStore.getState();
    const next = fn(state);
    if (next === state && !lastStoreWriteFailed()) return;
    // Nothing runs between reading the state and this call, so `next` is still its successor.
    state.syncTransaction(() => next);
  } finally {
    applying -= 1;
  }
}

/** The team collections of the store. */
export const teamData = (s: AppState): TeamData => ({
  teams: s.teams,
  players: s.players,
  seasons: s.seasons,
  opponents: s.opponents,
  matches: s.matches,
  presets: s.presets,
});

/** The store with the team's entities replaced (`undefined`: the team removed), copy-on-write. */
export function withSlice(s: AppState, teamId: string, slice: TeamSlice | undefined): TeamData {
  return replaceTeamSlice(teamData(s), teamId, slice);
}

export const sliceOf = (s: AppState, teamId: string): TeamSlice | undefined =>
  teamSlice(teamData(s), teamId);

/** `sync` with one team's bookkeeping replaced (`undefined`: unlinked). */
export function withTeamMeta(
  sync: SyncData,
  teamId: string,
  meta: SyncedTeam | undefined,
): SyncData {
  const { [teamId]: _old, ...rest } = sync.teams;
  return { ...sync, teams: meta ? { ...rest, [teamId]: meta } : rest };
}

export function setTeamMeta(teamId: string, meta: SyncedTeam | undefined): void {
  transaction((s) => {
    if (s.sync.teams[teamId] === meta) return s;
    if (!meta && !s.sync.teams[teamId]) return s;
    return { sync: withTeamMeta(s.sync, teamId, meta) };
  });
}

/** Forgets the live holds of these teams (they are no longer shared on this device). */
export function dropHolds(teamIds: readonly string[]): void {
  useSyncRuntime.setState((r) => {
    const holds = Object.fromEntries(
      Object.entries(r.holds).filter(([, h]) => !teamIds.includes(h.teamId)),
    );
    return Object.keys(holds).length === Object.keys(r.holds).length ? r : { holds };
  });
}

/** Stops syncing the teams on this device (their local copies stay). */
export function unlinkTeams(teamIds: readonly string[]): void {
  transaction((s) => {
    const gone = teamIds.filter((id) => s.sync.teams[id]);
    if (gone.length === 0) return s;
    const teams = { ...s.sync.teams };
    for (const id of gone) delete teams[id];
    return { sync: { ...s.sync, teams } };
  });
  dropHolds(teamIds);
}

/** Ids of the linked teams (of `userId`, or all). */
export function linkedTeamIds(userId?: string | null): string[] {
  const teams = appState().sync.teams;
  return Object.keys(teams).filter((id) => userId == null || teams[id].userId === userId);
}

export function teamName(teamId: string): string {
  return appState().teams.find((t) => t.id === teamId)?.name ?? '';
}

/** The linked profile's name (else the current profile's), for other members to see. */
export function displayName(): string {
  const s = appState();
  const profileId = s.sync.account?.profileId ?? s.currentProfileId;
  const name = s.profiles.find((p) => p.id === profileId)?.name ?? '';
  return name.trim().slice(0, NAME_LIMIT);
}

export function emitStatus(event: SyncStatusEvent): void {
  useSyncRuntime.setState((r) => {
    const status = nextSyncStatus(r.status, event);
    return status === r.status ? r : { status };
  });
}

/** Recounts the local changes waiting for the server (for the badge). */
export function updatePending(userId: string | null): void {
  const s = appState();
  const n = Object.keys(s.sync.teams).length === 0 ? 0 : pendingCount(s.sync, teamData(s), userId);
  emitStatus({ type: 'pending', n });
}

export function notify(notice: SyncNotice): void {
  useSyncRuntime.setState((r) => ({ notices: [...r.notices, notice] }));
}

/** Takes back the notices of one kind about a team (what they said no longer holds). */
export function dropNotices(kind: SyncNotice['kind'], teamId: string): void {
  useSyncRuntime.setState((r) => {
    const notices = r.notices.filter((n) => n.kind !== kind || n.teamId !== teamId);
    return notices.length === r.notices.length ? r : { notices };
  });
}

/** Resolves once the persisted store has loaded. */
export function whenHydrated(): Promise<void> {
  if (useAppStore.getState().hydrated) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = useAppStore.subscribe((s) => {
      if (!s.hydrated) return;
      stop();
      resolve();
    });
  });
}
