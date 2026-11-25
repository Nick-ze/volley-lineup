import { backoffMs, nextSyncStatus } from './syncStatus';
import type { SyncStatus } from './types';

const off: SyncStatus = {
  phase: 'off',
  pending: 0,
  lastSyncedAt: null,
  error: null,
  retryAt: null,
};
const AT = '2026-11-26T10:00:00.000Z';
const RETRY = '2026-11-26T10:00:10.000Z';

describe('nextSyncStatus', () => {
  it('goes syncing → synced and remembers when', () => {
    const syncing = nextSyncStatus(off, { type: 'start' });
    expect(syncing.phase).toBe('syncing');
    expect(nextSyncStatus(syncing, { type: 'done', at: AT })).toEqual({
      ...off,
      phase: 'synced',
      lastSyncedAt: AT,
    });
  });

  it('goes offline with a retry time (also for a failure with the offline code)', () => {
    const synced = { ...off, phase: 'synced' as const, lastSyncedAt: AT };
    const expected = { ...synced, phase: 'offline', retryAt: RETRY };
    expect(nextSyncStatus(synced, { type: 'offline', retryAt: RETRY })).toEqual(expected);
    expect(nextSyncStatus(synced, { type: 'failed', code: 'offline', retryAt: RETRY })).toEqual(
      expected,
    );
  });

  it('shows other failures as errors, and a new start clears them', () => {
    const error = nextSyncStatus(off, { type: 'failed', code: 'signedOut', retryAt: null });
    expect(error).toEqual({ ...off, phase: 'error', error: 'signedOut' });
    expect(nextSyncStatus(error, { type: 'start' })).toEqual({ ...off, phase: 'syncing' });
  });

  it('counts pending changes and turns off', () => {
    const pending = nextSyncStatus(off, { type: 'pending', n: 3 });
    expect(pending.pending).toBe(3);
    const offline = { ...pending, phase: 'offline' as const, retryAt: RETRY };
    expect(nextSyncStatus(offline, { type: 'disabled' })).toEqual({ ...off, pending: 3 });
  });

  it('returns the same object when nothing changes', () => {
    expect(nextSyncStatus(off, { type: 'disabled' })).toBe(off);
    expect(nextSyncStatus(off, { type: 'pending', n: 0 })).toBe(off);
  });
});

describe('backoffMs', () => {
  it('waits 10 s, 30 s, 2 min, then 5 min', () => {
    expect([1, 2, 3, 4, 5, 50].map(backoffMs)).toEqual([
      10_000, 30_000, 120_000, 300_000, 300_000, 300_000,
    ]);
    expect(backoffMs(0)).toBe(10_000);
    expect(backoffMs(-3)).toBe(10_000);
    expect(backoffMs(2.7)).toBe(30_000);
  });
});
