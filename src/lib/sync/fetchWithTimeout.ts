/**
 * v10: every backend request gives up after a while (then the app counts as offline).
 *
 * - Until the answer starts (its headers), a request has `REQUEST_TIMEOUT_MS` — longer when it
 *   sends a lot (v10 audit M5): a photo of up to 256 kB or a push batch must not need 35 kB/s
 *   of uplink. `MIN_UPLOAD_BYTES_PER_S` is the slowest uplink a request still gets through on,
 *   up to `MAX_REQUEST_TIMEOUT_MS`.
 * - While the answer's body arrives, the request gives up when nothing has come for
 *   `REQUEST_TIMEOUT_MS` (v10 audit M12). Before, the timer stopped at the headers and a body
 *   that stalled blocked the sync queue for good. It is a pause limit, not a limit for the whole
 *   body: a large download on a slow connection still finishes. Only where bodies arrive as a
 *   stream (browsers); React Native's `fetch` answers once the whole body is there, so the first
 *   timer already covers it.
 */
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_REQUEST_TIMEOUT_MS = 60_000;
export const MIN_UPLOAD_BYTES_PER_S = 4096;

/** Answers that never have a body (`new Response` refuses one for them). */
const NO_BODY_STATUS = new Set([101, 103, 204, 205, 304]);

/** The size of a request body where it can be told without reading it (else 0). */
function bodyBytes(body: unknown): number {
  if (typeof body === 'string') return body.length;
  if (typeof body !== 'object' || body === null) return 0;
  const sized = body as { byteLength?: unknown; size?: unknown };
  if (typeof sized.byteLength === 'number') return sized.byteLength;
  return typeof sized.size === 'number' ? sized.size : 0;
}

/** How long a request with this body may take until its answer starts. */
export function requestTimeoutMs(body: unknown, ms = REQUEST_TIMEOUT_MS): number {
  const upload = Math.ceil((bodyBytes(body) / MIN_UPLOAD_BYTES_PER_S) * 1000);
  return Math.max(ms, Math.min(upload, Math.max(ms, MAX_REQUEST_TIMEOUT_MS)));
}

/**
 * The answer that stalled. A `TypeError` with fetch's own "no connection" message, so every layer
 * of supabase-js and `toSyncError` treat it as offline; "timed out" tells `isTimeout`.
 */
const stalled = (): TypeError => new TypeError('Network request failed (the answer timed out)');

/**
 * Reads the whole body, giving up when nothing arrives for `ms`; returns the same answer with
 * the body already there. Answers without a readable stream are returned as they are.
 */
async function readBody(response: Response, ms: number, abort: () => void): Promise<Response> {
  const stream = response.body as ReadableStream<Uint8Array> | null | undefined;
  // Only an ordinary answer can be rebuilt (`new Response` takes 200–599, and no body for some).
  const rebuildable =
    response.status >= 200 && response.status <= 599 && !NO_BODY_STATUS.has(response.status);
  if (!stream || typeof stream.getReader !== 'function' || !rebuildable) return response;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pause = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abort();
        reject(stalled());
      }, ms);
    });
    try {
      const part = await Promise.race([reader.read(), pause]);
      if (part.done) break;
      chunks.push(part.value);
      size += part.value.byteLength;
    } finally {
      clearTimeout(timer);
    }
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  const whole = new Response(bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  // A rebuilt answer has no address of its own: keep the original's.
  for (const field of ['url', 'redirected', 'type'] as const) {
    Object.defineProperty(whole, field, { value: response[field] });
  }
  return whole;
}

/**
 * `fetch` that gives up when the answer doesn't start in time (`requestTimeoutMs`) or stalls
 * (the caller's own signal still works). A request that timed out rejects with an `AbortError`
 * or the stalled-answer `TypeError`; `toSyncError` maps both to offline.
 */
export function fetchWithTimeout(ms = REQUEST_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, requestTimeoutMs(init?.body, ms));
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) abort();
      else outer.addEventListener('abort', abort);
    }
    let response: Response;
    try {
      response = await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    return readBody(response, ms, abort);
  };
}
