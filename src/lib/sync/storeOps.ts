/**
 * v10: how the sync engine reads and writes the app's stores. Records and sync bookkeeping are
 * only written through `transaction` (one atomic `syncTransaction`), so both are persisted
 * together; the runtime store gets the status, session, holds and notices.
 */
import { replaceTeamSlice, teamSlice, type TeamData, type TeamSlice } from '@/domain/syncRecords';
import { pendingCount } from '@/domain/syncChanges';
import { nextSyncStatus, type SyncStatusEvent } from '@/domain/syncStatus';
import type { SyncData, SyncedTeam, SyncNotice } from '@/domain/types';
import { useAppStore, useSyncRuntime, type AppState, type AppStore } from '@/store';

/** A member's display name / a hold's holder name: at most this long on the server. */
const NAME_LIMIT = 60;

export const appState = (): AppStore => useAppStore.getState();

let applying = 0;

/** True while the engine itself writes the store (its own writes aren't user edits). */
export const isApplying = (): boolean => applying > 0;

/**
 * One atomic store write by the engine. Return `s` itself for "no change" (then nothing is
 * written or persisted).
 */
export function transaction(fn: (s: AppState) => Partial<AppState>): void {
  applying += 1;
  try {
    useAppStore.getState().syncTransaction(fn);
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

/** Stops syncing the teams on this device (their local copies stay). */
export function unlinkTeams(teamIds: readonly string[]): void {
  transaction((s) => {
    const gone = teamIds.filter((id) => s.sync.teams[id]);
    if (gone.length === 0) return s;
    const teams = { ...s.sync.teams };
    for (const id of gone) delete teams[id];
    return { sync: { ...s.sync, teams } };
  });
  useSyncRuntime.setState((r) => {
    const holds = Object.fromEntries(
      Object.entries(r.holds).filter(([, h]) => !teamIds.includes(h.teamId)),
    );
    return Object.keys(holds).length === Object.keys(r.holds).length ? r : { holds };
  });
}

/** Ids of the linked teams (of `userId`, or all). */
export function linkedTeamIds(userId?: string | null): string[] {
  const teams = appState().sync.teams;
  return Object.keys(teams).filter((id) => userId == null || teams[id].userId === userId);
}

export const teamMeta = (teamId: string): SyncedTeam | undefined => appState().sync.teams[teamId];

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
