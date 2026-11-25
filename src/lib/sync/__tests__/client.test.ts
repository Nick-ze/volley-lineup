/**
 * v10: the supabase-js client is created lazily with the agreed options; the session key is
 * read without creating it; requests time out.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { authStorageKey, getClient, hasStoredSession, whenClientCreated } from '../client';
import { syncConfig } from '../config';
import { fetchWithTimeout } from '../fetchWithTimeout';

jest.mock('../config', () => ({ syncConfig: jest.fn(() => null) }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { startAutoRefresh: jest.fn(async () => undefined), stopAutoRefresh: jest.fn() },
  })),
}));

const CONFIG = { url: 'https://abcdef.supabase.co', publishableKey: 'sb_publishable_x' };

describe('client', () => {
  it('without a config: no client (notSignedIn) and no stored session', async () => {
    expect(() => getClient()).toThrow(expect.objectContaining({ code: 'notSignedIn' }));
    expect(await hasStoredSession()).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('is created once, on first use, with AsyncStorage and the 15 s fetch', async () => {
    jest.mocked(syncConfig).mockReturnValue(CONFIG);
    expect(authStorageKey(CONFIG)).toBe('sb-abcdef-auth-token');
    expect(await hasStoredSession()).toBe(false);
    await AsyncStorage.setItem('sb-abcdef-auth-token', '{}');
    expect(await hasStoredSession()).toBe(true);
    expect(createClient).not.toHaveBeenCalled();

    const seen: unknown[] = [];
    whenClientCreated((c) => seen.push(c));
    const client = getClient();
    expect(getClient()).toBe(client);
    expect(seen).toEqual([client]);
    whenClientCreated((c) => seen.push(c));
    expect(seen).toEqual([client, client]);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(CONFIG.url, CONFIG.publishableKey, {
      auth: {
        storage: AsyncStorage,
        storageKey: 'sb-abcdef-auth-token',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: { fetch: expect.any(Function) },
    });
    // Native: the token refresh follows the app state (started or stopped at once).
    const { startAutoRefresh, stopAutoRefresh } = jest.mocked(client.auth);
    expect(startAutoRefresh.mock.calls.length + stopAutoRefresh.mock.calls.length).toBe(1);
  });

  it('a stored session can’t be read: counts as none', async () => {
    jest.mocked(syncConfig).mockReturnValue(CONFIG);
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('broken'));
    expect(await hasStoredSession()).toBe(false);
  });
});

describe('fetchWithTimeout', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it('aborts after the timeout (and when the caller aborts)', async () => {
    jest.useFakeTimers();
    const signals: AbortSignal[] = [];
    global.fetch = jest.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal;
          signals.push(signal);
          const abort = () => reject(new DOMException('aborted', 'AbortError'));
          if (signal.aborted) abort();
          else signal.addEventListener('abort', abort);
        }),
    ) as typeof fetch;
    const timed = fetchWithTimeout(1000);
    const first = timed('https://x.test');
    jest.advanceTimersByTime(1000);
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });

    const outer = new AbortController();
    const second = timed('https://x.test', { signal: outer.signal });
    outer.abort();
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });

    const already = new AbortController();
    already.abort();
    await expect(timed('https://x.test', { signal: already.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it('passes the response through', async () => {
    const response = { ok: true } as Response;
    global.fetch = jest.fn(async () => response) as typeof fetch;
    await expect(fetchWithTimeout()('https://x.test', { method: 'POST' })).resolves.toBe(response);
  });
});
