/**
 * v10: the supabase-js client, created on first use (never at import time, so local-only users
 * and tests never start it). The session is kept in AsyncStorage and refreshed automatically;
 * requests time out after 15 s.
 *
 * v10 audit L33: the URL polyfill and supabase-js themselves are loaded only then too, so a
 * start-up problem of either on a phone can't hit users without an account.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { keepSessionOnOutage } from './authFetch';
import { keepTokenFresh } from './autoRefresh';
import { syncConfig, type SyncConfig } from './config';
import { BackendError } from './errors';
import { fetchWithTimeout } from './fetchWithTimeout';

let client: SupabaseClient | null = null;
const created: ((client: SupabaseClient) => void)[] = [];

/**
 * The storage key supabase-js keeps the session under (its default for the project URL: the
 * host name's first label). Read without `URL`: it runs before the polyfill is loaded (L33).
 */
export function authStorageKey(config: SyncConfig): string {
  const host = config.url.replace(/^[a-z]+:\/\//i, '').split(/[/:?#]/)[0] ?? '';
  return `sb-${host.split('.')[0]}-auth-token`;
}

/** supabase-js, loaded on first use: the polyfill first (native builds; nothing on web). */
function loadSupabase(): typeof import('@supabase/supabase-js') {
  /* eslint-disable @typescript-eslint/no-require-imports -- loaded lazily on purpose (L33) */
  require('./polyfill');
  return require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  /* eslint-enable @typescript-eslint/no-require-imports */
}

/** The client (created now if needed). Throws `notSignedIn` when the backend isn't configured. */
export function getClient(): SupabaseClient {
  if (client) return client;
  const config = syncConfig();
  if (!config) throw new BackendError('notSignedIn');
  const { createClient } = loadSupabase();
  const next = createClient(config.url, config.publishableKey, {
    auth: {
      storage: AsyncStorage,
      storageKey: authStorageKey(config),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    // Outages must not sign the device out (authFetch.ts).
    global: { fetch: keepSessionOnOutage(fetchWithTimeout()) },
    // No postgrest retries (it retries failed GETs ~3 times over ~7 s): the engine has its own
    // offline back-off, and the retries kept the badge on "Syncing…" while offline.
    db: { retry: false },
  });
  client = next;
  keepTokenFresh(next.auth);
  for (const listener of created.splice(0)) listener(next);
  return next;
}

/** Runs `listener` with the client once it exists (at once if it already does). */
export function whenClientCreated(listener: (client: SupabaseClient) => void): void {
  if (client) listener(client);
  else created.push(listener);
}

/** Whether a session is stored, read from AsyncStorage without creating the client. */
export async function hasStoredSession(): Promise<boolean> {
  const config = syncConfig();
  if (!config) return false;
  try {
    return (await AsyncStorage.getItem(authStorageKey(config))) !== null;
  } catch {
    return false;
  }
}
