/**
 * v10: backend errors → the app's `SyncErrorCode` (docs/V10_SYNC_DESIGN.md §3.7, docs/SUPABASE.md
 * "Error codes"). Everything the backend can throw goes through `toSyncError`, so the UI only
 * ever sees a short code it has a message for.
 *
 * - SQLSTATE from the RPCs: 42501 forbidden · VL001 lastManager · VL002 inviteInvalid · VL004
 *   lastMember · VL006 / VL007 tooMany · VL008 photos remain (the caller cleans up and retries) ·
 *   22023 / 23514 unknown.
 * - No connection, a timeout, HTTP ≥ 500 or a paused project → offline (never an error screen).
 * - Auth: an expired / wrong code → invalidCode; 429 / rate limits → rateLimited; a refresh
 *   token or session the server no longer knows → signedOut.
 */
import type { SyncErrorCode } from '@/domain/types';

/** A failed backend call: the app's code plus the server's raw code (e.g. `VL008`). */
export class BackendError extends Error {
  constructor(
    readonly code: SyncErrorCode,
    readonly raw: string = '',
    readonly detail: string = '',
  ) {
    super(`sync: ${code}${raw ? ` (${raw})` : ''}`);
    this.name = 'BackendError';
  }
}

const SQL_CODES: Readonly<Record<string, SyncErrorCode>> = {
  '42501': 'forbidden',
  VL001: 'lastManager',
  VL002: 'inviteInvalid',
  VL004: 'lastMember',
  VL006: 'tooMany',
  VL007: 'tooMany',
  // PostgREST: the JWT is missing / invalid / expired and could not be refreshed.
  PGRST301: 'signedOut',
  PGRST302: 'signedOut',
  PGRST303: 'signedOut',
};

const AUTH_CODES: Readonly<Record<string, SyncErrorCode>> = {
  otp_expired: 'invalidCode',
  invalid_credentials: 'invalidCode',
  over_email_send_rate_limit: 'rateLimited',
  over_request_rate_limit: 'rateLimited',
  refresh_token_not_found: 'signedOut',
  refresh_token_already_used: 'signedOut',
  session_not_found: 'signedOut',
  session_expired: 'signedOut',
  user_not_found: 'signedOut',
  bad_jwt: 'signedOut',
  // v10 audit M13: the address can't be used to sign in.
  email_address_invalid: 'emailRejected',
  email_address_not_authorized: 'emailRejected',
  signup_disabled: 'emailRejected',
  email_provider_disabled: 'emailRejected',
};

const OFFLINE_NAMES = new Set([
  'AbortError',
  'TimeoutError',
  'AuthRetryableFetchError',
  'FetchError',
]);

/**
 * What `fetch` says when there is no connection: React Native "Network request failed", Chrome
 * "Failed to fetch", Safari "Load failed", Firefox "NetworkError when attempting to fetch
 * resource", Node "fetch failed"; `authFetch.ts` and `fetchWithTimeout.ts` use the first (the
 * latter for an answer that stalled, with "timed out": see `isTimeout`).
 */
const NETWORK_MESSAGE =
  /network request failed|failed to fetch|load failed|networkerror|fetch failed|network error/i;

type Fields = Partial<Record<'name' | 'message' | 'code' | 'status' | 'statusCode', unknown>> & {
  originalError?: unknown;
};

const text = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

function httpStatus(e: Fields): number {
  if (typeof e.status === 'number') return e.status;
  const code = text(e.statusCode);
  return /^\d+$/.test(code) ? Number(code) : -1;
}

/**
 * v10 audit M13: an error of a code request. An answer with HTTP 500 means the auth server
 * couldn't send the email (`authFetch.ts` lets exactly that one through; auth-js reports it with
 * `status: 500`, a lost connection with 0); a refused address format reads as a refused address.
 */
export function requestCodeError(error: unknown): BackendError {
  const e = (typeof error === 'object' && error !== null ? error : {}) as Fields;
  if (httpStatus(e) === 500) return new BackendError('mailFailed', text(e.code));
  if (text(e.code) === 'validation_failed') {
    return new BackendError('emailRejected', 'validation_failed');
  }
  return backendError(error);
}

/** The app's error code for anything a backend call threw or returned as `error`. */
export function toSyncError(error: unknown): SyncErrorCode {
  if (error instanceof BackendError) return error.code;
  if (typeof error !== 'object' || error === null) return 'unknown';
  const e = error as Fields;
  const code = text(e.code);
  const name = text(e.name);
  const message = text(e.message);
  if (SQL_CODES[code]) return SQL_CODES[code];
  if (AUTH_CODES[code]) return AUTH_CODES[code];
  if (name === 'AuthSessionMissingError') return 'notSignedIn';
  if (OFFLINE_NAMES.has(name) || /^(AbortError|FetchError|TimeoutError):/.test(message)) {
    return 'offline';
  }
  // v10 audit L5: a TypeError is "offline" only when it is fetch's own "no connection" error, so
  // a programming error isn't hidden behind the offline badge.
  if ((name === 'TypeError' || /^TypeError:/.test(message)) && NETWORK_MESSAGE.test(message)) {
    return 'offline';
  }
  if (e.originalError !== undefined) return toSyncError(e.originalError);
  const status = httpStatus(e);
  if (status === 0 || status >= 500) return 'offline';
  if (status === 429) return 'rateLimited';
  // Before the 401 / 403 rule: an old auth server without error codes answers a wrong code
  // with 403 and this message (v10 audit L16).
  if (/token has expired or is invalid/i.test(message)) return 'invalidCode';
  if (status === 401 || status === 403) return 'forbidden';
  return 'unknown';
}

/** `BackendError.raw` of a request that got no answer in time (see `isTimeout`). */
const TIMEOUT = 'timeout';

/** What a timed-out request says: the abort of `fetchWithTimeout`, or its stalled-answer error. */
const TIMEOUT_MESSAGE = /^(AbortError|TimeoutError):|timed out/i;

function timedOut(error: unknown, depth = 0): boolean {
  if (typeof error !== 'object' || error === null || depth > 3) return false;
  const e = error as Fields;
  const name = text(e.name);
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  if (TIMEOUT_MESSAGE.test(text(e.message))) return true;
  return timedOut(e.originalError, depth + 1);
}

/** `error` as a `BackendError` (kept when it already is one), with the server's raw code. */
export function backendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const fields = (typeof error === 'object' && error !== null ? error : {}) as Fields & {
    details?: unknown;
  };
  const code = toSyncError(error);
  const raw = text(fields.code) || (code === 'offline' && timedOut(error) ? TIMEOUT : '');
  return new BackendError(code, raw, text(fields.details));
}

/**
 * True when a request got no answer in time — as opposed to "no connection at all". The data may
 * be too much for the connection: a push is then tried again in smaller parts (v10 audit M5).
 */
export const isTimeout = (error: unknown): boolean =>
  error instanceof BackendError
    ? error.raw === TIMEOUT
    : toSyncError(error) === 'offline' && timedOut(error);

/**
 * SQLSTATEs with which the server refuses what a push sends, whatever else is in the batch
 * (v10 audit M4): a CHECK of `team_records` (an id over 200 characters, a payload over 64 kB),
 * a malformed or oversized batch, a character the database can't store (NUL: 22P05) and a text
 * it can't read (half of a character pair: 22P02, checked against PostgreSQL 16; such records
 * are already held back before the push, `textIsWhole`).
 */
const REFUSED_CONTENT = new Set(['23514', '22023', '22P05', '22P02']);

/** The server refused the content of a push (not the caller, the connection or the team). */
export const isRefusedContent = (error: unknown): boolean =>
  error instanceof BackendError && REFUSED_CONTENT.has(error.raw);

/** The server refused because the team's photos are still stored (`VL008`). */
export const isPhotosRemain = (error: unknown): boolean =>
  error instanceof BackendError && error.raw === 'VL008';

/** Storage has no such object (a photo removed or never uploaded). */
export const isNotFound = (error: unknown): boolean =>
  error instanceof BackendError && error.raw === 'not_found';
