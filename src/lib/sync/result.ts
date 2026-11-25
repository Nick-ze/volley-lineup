import type { BackendSession } from './backend';
import type { EngineCore } from './core';
import { BackendError, toSyncError } from './errors';
import type { SyncResult } from './types';

/** Runs a command: its value, or the error code of whatever it threw (commands never throw). */
export async function attempt<T>(fn: () => Promise<T>): Promise<SyncResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    return { ok: false, error: toSyncError(e) };
  }
}

/** The session, or `notSignedIn` (thrown) — checked before any network call. */
export function requireSession(core: EngineCore): BackendSession {
  const session = core.session();
  if (!session) throw new BackendError('notSignedIn');
  return session;
}
