/**
 * v10: the sync engine's runtime state (never persisted): status for the badge, the signed-in
 * session, live-match holds of shared teams and notices to show once. Written only by
 * `src/lib/sync`; screens read it through the hooks in `syncHooks.ts`.
 */
import { create } from 'zustand';

import type { MatchHold, SyncNotice, SyncStatus } from '@/domain/types';

export interface SyncSession {
  userId: string;
  email: string;
}

export interface SyncRuntimeState {
  status: SyncStatus;
  session: SyncSession | null;
  /** Holds of matches of shared teams, by match id (refreshed every sync). */
  holds: Record<string, MatchHold>;
  notices: SyncNotice[];
}

export const initialSyncStatus = (): SyncStatus => ({
  phase: 'off',
  pending: 0,
  lastSyncedAt: null,
  error: null,
  retryAt: null,
});

const initialRuntime = (): SyncRuntimeState => ({
  status: initialSyncStatus(),
  session: null,
  holds: {},
  notices: [],
});

export const useSyncRuntime = create<SyncRuntimeState>()(() => initialRuntime());

/** Removes a notice once the user has seen / dismissed it. */
export function dismissSyncNotice(notice: SyncNotice): void {
  useSyncRuntime.setState((s) => ({ notices: s.notices.filter((n) => n !== notice) }));
}

/** Tests only: back to "not signed in, nothing synced". */
export function resetSyncRuntimeForTests(): void {
  useSyncRuntime.setState(initialRuntime());
}
