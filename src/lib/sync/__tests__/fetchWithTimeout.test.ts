/**
 * v10 audit (docs/AUDIT_V10.md M5, M12): the request timeout.
 *
 * M5 — a request that sends a lot (a photo, a push batch) gets more time until its answer
 * starts: 15 s for up to 256 kB meant 35 kB/s of uplink or every try timed out the same way.
 *
 * M12 — the timer used to stop when the answer's headers arrived; a body that stalled after
 * them was waited for without end, and the sync queue with it. Now a body that brings nothing
 * for 15 s ends the request (as "offline"). It is a pause limit: a slow but steady download of
 * any size still finishes.
 */
import { createClient } from '@supabase/supabase-js';

import { isTimeout, toSyncError } from '../errors';
import {
  fetchWithTimeout,
  MAX_REQUEST_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  requestTimeoutMs,
} from '../fetchWithTimeout';
import { createSupabaseBackend } from '../supabaseBackend';

const realFetch = global.fetch;
const encode = (text: string) => new TextEncoder().encode(text);

afterEach(() => {
  global.fetch = realFetch;
  jest.useRealTimers();
});

/** A `fetch` that never answers; it rejects like the real one when its signal aborts. */
function neverAnswers(signals: AbortSignal[] = []): typeof fetch {
  return jest.fn(
    (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal;
        signals.push(signal);
        signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })),
        );
      }),
  ) as typeof fetch;
}

/** An answer whose body arrives in `parts`, one every `everyMs`, and then ends or stalls. */
function answerInParts(parts: string[], everyMs: number, thenStalls = false): Response {
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      return new Promise<void>((resolve) => {
        if (sent === parts.length) {
          if (!thenStalls) {
            controller.close();
            resolve();
          }
          return; // stalls: never resolves, never closes
        }
        setTimeout(() => {
          controller.enqueue(encode(parts[sent]));
          sent += 1;
          resolve();
        }, everyMs);
      });
    },
  });
  return new Response(stream, {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json', 'x-test': 'kept' },
  });
}

describe('requestTimeoutMs (audit M5)', () => {
  it('is 15 s for a request that sends little or nothing', () => {
    expect(requestTimeoutMs(undefined)).toBe(REQUEST_TIMEOUT_MS);
    expect(requestTimeoutMs(null)).toBe(REQUEST_TIMEOUT_MS);
    expect(requestTimeoutMs('{"p_after":0}')).toBe(REQUEST_TIMEOUT_MS);
    expect(requestTimeoutMs('x'.repeat(60_000))).toBe(REQUEST_TIMEOUT_MS);
    expect(requestTimeoutMs(new FormData())).toBe(REQUEST_TIMEOUT_MS);
    expect(requestTimeoutMs(7)).toBe(REQUEST_TIMEOUT_MS);
  });

  it('grows with what is sent: an uplink of 4 kB/s still gets it through', () => {
    expect(requestTimeoutMs('x'.repeat(128 * 1024))).toBe(32_000);
    expect(requestTimeoutMs(new Uint8Array(100 * 1024))).toBe(25_000);
    expect(requestTimeoutMs(new Uint8Array(100 * 1024).buffer)).toBe(25_000);
    expect(requestTimeoutMs(new Blob([new Uint8Array(100 * 1024)]))).toBe(25_000);
  });

  it('is at most a minute: a full photo (256 kB) or a full push batch (512 kB)', () => {
    expect(requestTimeoutMs(new Uint8Array(256 * 1024))).toBe(MAX_REQUEST_TIMEOUT_MS);
    expect(requestTimeoutMs('x'.repeat(512 * 1024))).toBe(MAX_REQUEST_TIMEOUT_MS);
  });

  it('never is shorter than the base time it is given', () => {
    expect(requestTimeoutMs('x', 90_000)).toBe(90_000);
    expect(requestTimeoutMs('x'.repeat(512 * 1024), 90_000)).toBe(90_000);
    expect(requestTimeoutMs('x'.repeat(8192), 1000)).toBe(2000);
  });
});

describe('until the answer starts', () => {
  it('a small request still gives up after 15 s', async () => {
    jest.useFakeTimers();
    global.fetch = neverAnswers();
    const request = fetchWithTimeout()('https://x.test/rest/v1/rpc/pull_changes', {
      method: 'POST',
      body: '{"p_after":0}',
    });
    const outcome = request.catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(14_999);
    await jest.advanceTimersByTimeAsync(1);
    const error = await outcome;
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(toSyncError(error)).toBe('offline');
    expect(isTimeout(error)).toBe(true);
  });

  it('a 200 kB upload isn’t cut off after 15 s any more, but after 50 s (audit M5)', async () => {
    jest.useFakeTimers();
    const signals: AbortSignal[] = [];
    global.fetch = neverAnswers(signals);
    const request = fetchWithTimeout()('https://x.test/storage/v1/object/team-photos/t/p', {
      method: 'POST',
      body: new Uint8Array(200 * 1024),
    });
    const outcome = request.catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(49_999);
    expect(signals[0].aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(signals[0].aborted).toBe(true);
    expect(await outcome).toMatchObject({ name: 'AbortError' });
  });
});

/*
 * The body tests run on real time with a short limit (`PAUSE`): Node's streams don't move under
 * Jest's fake timers.
 */
const PAUSE = 300;
const STEP = 60;

describe('while the answer’s body arrives (audit M12)', () => {
  it('a body that stalls after the headers ends the request after the limit of silence', async () => {
    const signals: AbortSignal[] = [];
    global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return answerInParts(['{"rows":['], STEP, true);
    }) as typeof fetch;
    const started = Date.now();
    const error = await fetchWithTimeout(PAUSE)('https://x.test/rest/v1/rpc/pull_changes').catch(
      (e: unknown) => e,
    );
    // Not before the limit has passed since the last part.
    expect(Date.now() - started).toBeGreaterThanOrEqual(STEP + PAUSE - 20);
    expect(error).toBeInstanceOf(TypeError);
    expect((error as Error).message).toMatch(/^Network request failed/);
    expect(toSyncError(error)).toBe('offline');
    expect(isTimeout(error)).toBe(true);
    // The connection is given up too.
    expect(signals[0].aborted).toBe(true);
  });

  it('the limit of silence isn’t longer for a request that sent a lot (that time was for sending)', async () => {
    // 8 kB may take 2 s until the answer starts (the slowest uplink a request still gets through
    // on). Once it has started, silence is silence.
    const body = 'x'.repeat(2 * 4096);
    expect(requestTimeoutMs(body, PAUSE)).toBe(2000);
    global.fetch = jest.fn(async () => answerInParts(['{"rows":['], STEP, true)) as typeof fetch;
    const started = Date.now();
    const error = await fetchWithTimeout(PAUSE)('https://x.test/rest/v1/rpc/push_records', {
      method: 'POST',
      body,
    }).catch((e: unknown) => e);
    expect(isTimeout(error)).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('a slow but steady body is read to its end, however long it takes in all', async () => {
    const parts = ['{"rows":[', '1,', '2,', '3,', '4,', '5,', '6,', '7', ']}'];
    const original = answerInParts(parts, STEP);
    Object.defineProperty(original, 'url', { value: 'https://x.test/final' });
    const signals: AbortSignal[] = [];
    global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return original;
    }) as typeof fetch;
    const started = Date.now();
    const response = await fetchWithTimeout(PAUSE)('https://x.test/rest/v1/rpc/pull_changes');
    // Longer in all than the limit, but never that long without a part.
    expect(Date.now() - started).toBeGreaterThan(PAUSE);
    expect(signals[0].aborted).toBe(false);
    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(response.statusText).toBe('OK');
    expect(response.headers.get('x-test')).toBe('kept');
    expect(response.url).toBe('https://x.test/final');
    await expect(response.json()).resolves.toEqual({ rows: [1, 2, 3, 4, 5, 6, 7] });
  });

  it('gives the bytes back as they came (a photo download)', async () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 251);
    global.fetch = jest.fn(
      async () => new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } }),
    ) as typeof fetch;
    const response = await fetchWithTimeout()('https://x.test/storage/v1/object/a/b');
    const blob = await response.blob();
    expect(blob.type).toBe('image/png');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  });

  it('passes on an answer without a body, and one whose body isn’t a stream (React Native)', async () => {
    const empty = new Response(null, { status: 204 });
    global.fetch = jest.fn(async () => empty) as typeof fetch;
    await expect(fetchWithTimeout()('https://x.test')).resolves.toBe(empty);
    const native = { ok: true, status: 200, json: async () => ({ a: 1 }) } as unknown as Response;
    global.fetch = jest.fn(async () => native) as typeof fetch;
    await expect(fetchWithTimeout()('https://x.test')).resolves.toBe(native);
  });

  it('an error answer keeps its status and body', async () => {
    global.fetch = jest.fn(
      async () => new Response('{"code":"23514","message":"check"}', { status: 400 }),
    ) as typeof fetch;
    const response = await fetchWithTimeout()('https://x.test/rest/v1/rpc/push_records');
    expect(response.status).toBe(400);
    expect(response.ok).toBe(false);
    await expect(response.json()).resolves.toEqual({ code: '23514', message: 'check' });
  });
});

describe('through supabase-js (the real client, a fake fetch)', () => {
  const backendWith = (answer: () => Response) => {
    global.fetch = jest.fn(async () => answer()) as typeof fetch;
    const client = createClient('https://test.supabase.co', 'sb_publishable_test', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout(PAUSE) },
      db: { retry: false },
    });
    return createSupabaseBackend(() => client);
  };

  it('a pull whose answer stalls is "offline" and counts as timed out, not as an error', async () => {
    const backend = backendWith(() => answerInParts(['{"server_now":'], STEP, true));
    const error = await backend.pullChanges('t1', 0, 500).catch((e: unknown) => e);
    expect(toSyncError(error)).toBe('offline');
    expect(isTimeout(error)).toBe(true);
  });

  it('a pull that arrives in parts is read as before', async () => {
    const body = JSON.stringify({ server_now: '2026-11-26T10:00:00.000Z', rows: [] });
    const backend = backendWith(() => answerInParts([body.slice(0, 10), body.slice(10)], STEP));
    await expect(backend.pullChanges('t1', 0, 500)).resolves.toEqual({
      serverNow: '2026-11-26T10:00:00.000Z',
      rows: [],
    });
  });

  it('a photo download that stalls is "offline" too', async () => {
    const backend = backendWith(() => answerInParts(['\u0089PNG'], STEP, true));
    const error = await backend.downloadPhoto('t1', 'ph1').catch((e: unknown) => e);
    expect(toSyncError(error)).toBe('offline');
  });
});
