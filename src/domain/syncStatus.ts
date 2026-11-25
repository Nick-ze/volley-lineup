/**
 * v10: the sync status shown by the badge and the Account screen (docs/V10_SYNC_DESIGN.md §3.4,
 * §3.7). Pure.
 *
 * Phases: off (no account / nothing shared), syncing, synced, offline (no connection or a paused
 * server: the app keeps working and retries with a growing delay) and error (something the user
 * has to do, e.g. sign in again).
 */
import type { SyncErrorCode, SyncStatus } from './types';

export type SyncStatusEvent =
  | { type: 'disabled' }
  | { type: 'start' }
  | { type: 'done'; at: string }
  | { type: 'offline'; retryAt: string }
  | { type: 'failed'; code: SyncErrorCode; retryAt: string | null }
  | { type: 'pending'; n: number };

function apply(s: SyncStatus, e: SyncStatusEvent): SyncStatus {
  switch (e.type) {
    case 'disabled':
      return { ...s, phase: 'off', error: null, retryAt: null };
    case 'start':
      return { ...s, phase: 'syncing', error: null, retryAt: null };
    case 'done':
      return { ...s, phase: 'synced', lastSyncedAt: e.at, error: null, retryAt: null };
    case 'offline':
      return { ...s, phase: 'offline', error: null, retryAt: e.retryAt };
    case 'failed':
      return e.code === 'offline'
        ? { ...s, phase: 'offline', error: null, retryAt: e.retryAt }
        : { ...s, phase: 'error', error: e.code, retryAt: e.retryAt };
    case 'pending':
      return { ...s, pending: e.n };
  }
}

/** The status after an event (the same object when nothing changes, so nothing re-renders). */
export function nextSyncStatus(s: SyncStatus, e: SyncStatusEvent): SyncStatus {
  const next = apply(s, e);
  const same = (Object.keys(next) as (keyof SyncStatus)[]).every((k) => next[k] === s[k]);
  return same ? s : next;
}

const BACKOFF_MS = [10_000, 30_000, 120_000, 300_000] as const;

/**
 * How long to wait before the next try after `attempt` failures in a row (1 = the first):
 * 10 s, 30 s, 2 min, then 5 min.
 */
export function backoffMs(attempt: number): number {
  const index = Math.min(Math.max(Math.floor(attempt), 1), BACKOFF_MS.length) - 1;
  return BACKOFF_MS[index];
}
