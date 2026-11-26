/**
 * v10 audit H7: a paused project (HTTP 540) or a rate-limited token refresh (429) must not sign
 * the device out. The wrapper is tested alone and with the real supabase-js client (a fake
 * `fetch`, no network), because the behaviour it guards against lives in auth-js.
 */
import { createClient } from '@supabase/supabase-js';

import { keepSessionOnOutage } from '../authFetch';
import { requestCodeError, toSyncError } from '../errors';

const AUTH = 'https://test.supabase.co/auth/v1';
const REFRESH = `${AUTH}/token?grant_type=refresh_token`;
const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const answering =
  (response: () => Response): typeof fetch =>
  async () =>
    response();

describe('keepSessionOnOutage', () => {
  const call = (url: string | URL | Request, status: number) =>
    keepSessionOnOutage(answering(() => json(status)))(url);

  it('turns an outage answer of the auth API into a network error', async () => {
    for (const status of [500, 503, 540, 599]) {
      await expect(call(REFRESH, status)).rejects.toThrow(TypeError);
      // A plain 500 on a code request is the mail server failing (v10 audit M13, next test).
      if (status !== 500) await expect(call(`${AUTH}/otp`, status)).rejects.toThrow(TypeError);
    }
    const error = await call(REFRESH, 540).catch((e: unknown) => e);
    expect(toSyncError(error)).toBe('offline');
  });

  it('a rate-limited refresh is temporary too; a rate-limited code request is not hidden', async () => {
    await expect(call(REFRESH, 429)).rejects.toThrow(TypeError);
    await expect(call(new URL(REFRESH), 429)).rejects.toThrow(TypeError);
    await expect(call(new Request(REFRESH, { method: 'POST' }), 429)).rejects.toThrow(TypeError);
    expect((await call(`${AUTH}/otp`, 429)).status).toBe(429);
    expect((await call(`${AUTH}/verify`, 429)).status).toBe(429);
  });

  it('passes a code request’s plain 500 through: the email couldn’t be sent (audit M13)', async () => {
    expect((await call(`${AUTH}/otp`, 500)).status).toBe(500);
    expect((await call(`${AUTH}/otp?redirect_to=x`, 500)).status).toBe(500);
    await expect(call(`${AUTH}/otp`, 540)).rejects.toThrow(TypeError);
    await expect(call(`${AUTH}/verify`, 500)).rejects.toThrow(TypeError);
  });

  it('passes everything else through: real auth answers and the other APIs', async () => {
    expect((await call(REFRESH, 200)).status).toBe(200);
    // A refresh token the server no longer knows really is "signed out".
    expect((await call(REFRESH, 400)).status).toBe(400);
    expect((await call(`${AUTH}/verify`, 403)).status).toBe(403);
    expect((await call('https://test.supabase.co/rest/v1/rpc/pull_changes', 540)).status).toBe(540);
    expect((await call('https://test.supabase.co/storage/v1/object/x', 503)).status).toBe(503);
  });

  it('lets the inner fetch fail as it does', async () => {
    const offline: typeof fetch = async () => {
      throw new TypeError('Network request failed');
    };
    await expect(keepSessionOnOutage(offline)(REFRESH)).rejects.toThrow('Network request failed');
  });
});

describe('with the real supabase-js client', () => {
  const KEY = 'sb-test-auth-token';
  const memory = new Map<string, string>();
  const storage = {
    getItem: async (k: string) => memory.get(k) ?? null,
    setItem: async (k: string, v: string) => void memory.set(k, v),
    removeItem: async (k: string) => void memory.delete(k),
  };

  /** A stored session whose access token expired a minute ago (the next call refreshes it). */
  function seedExpiredSession() {
    memory.set(
      KEY,
      JSON.stringify({
        access_token: 'a.b.c',
        refresh_token: 'r1',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) - 60,
        user: { id: 'u1', email: 'anna@example.test', aud: 'authenticated' },
      }),
    );
  }

  /** `getSession()` of a client whose server answers every request with `response`. */
  async function getSession(response: () => Response, wrapped: boolean) {
    const inner = answering(response);
    const client = createClient('https://test.supabase.co', 'sb_publishable_x', {
      auth: {
        storage,
        storageKey: KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: wrapped ? keepSessionOnOutage(inner) : inner },
    });
    const events: string[] = [];
    client.auth.onAuthStateChange((event) => {
      events.push(event);
    });
    const pending = client.auth.getSession();
    // auth-js retries a temporary failure for up to 30 s before it gives up (session kept).
    await jest.advanceTimersByTimeAsync(60_000);
    const result = await pending;
    return { result, events, stored: memory.has(KEY) };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    memory.clear();
    seedExpiredSession();
  });
  afterEach(() => jest.useRealTimers());

  it.each([
    ['a paused project (540, JSON)', () => json(540, { message: 'Project paused' })],
    ['a paused project (540, HTML)', () => new Response('<html>paused</html>', { status: 540 })],
    ['a rate-limited refresh (429)', () => json(429, { code: 'over_request_rate_limit' })],
  ])('%s keeps the stored session and counts as offline', async (_name, response) => {
    const { result, events, stored } = await getSession(response, true);
    expect(stored).toBe(true);
    expect(events).not.toContain('SIGNED_OUT');
    expect(toSyncError(result.error)).toBe('offline');
  });

  it('without the wrapper auth-js signs the device out on a 540 (why the wrapper exists)', async () => {
    const { events, stored } = await getSession(() => json(540, { message: 'paused' }), false);
    expect(stored).toBe(false);
    expect(events).toContain('SIGNED_OUT');
  });

  it('a refresh token the server refuses still signs out', async () => {
    const refused = () => json(400, { code: 'refresh_token_not_found', message: 'Invalid' });
    const { stored } = await getSession(refused, true);
    expect(stored).toBe(false);
  });

  /** The error of a code request whose server answers with `response` (audit M13). */
  async function requestCode(response: () => Response) {
    const client = createClient('https://test.supabase.co', 'sb_publishable_x', {
      auth: { storage, storageKey: KEY, persistSession: true, detectSessionInUrl: false },
      global: { fetch: keepSessionOnOutage(answering(response)) },
    });
    const { error } = await client.auth.signInWithOtp({ email: 'anna@example.test' });
    return toSyncError(requestCodeError(error));
  }

  it('a code request the mail server couldn’t send reads mailFailed, not offline (M13)', async () => {
    const failed = () =>
      json(500, {
        code: 500,
        error_code: 'unexpected_failure',
        msg: 'Error sending magic link email',
      });
    expect(await requestCode(failed)).toBe('mailFailed');
    // A paused project or a gateway error is still "offline".
    expect(await requestCode(() => json(540, { message: 'paused' }))).toBe('offline');
    expect(await requestCode(() => json(503, {}))).toBe('offline');
  });

  it.each([
    ['email_address_invalid', 400],
    ['email_address_not_authorized', 400],
    ['signup_disabled', 422],
    ['email_provider_disabled', 422],
    ['validation_failed', 400],
  ])('a refused address (%s) reads emailRejected (M13)', async (code, status) => {
    expect(await requestCode(() => json(status, { error_code: code, msg: 'refused' }))).toBe(
      'emailRejected',
    );
  });
});
