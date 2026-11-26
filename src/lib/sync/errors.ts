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
 * resource", Node "fetch failed"; `authFetch.ts` and `fetchWithTimeout.ts` use the first.
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

/** `error` as a `BackendError` (kept when it already is one), with the server's raw code. */
export function backendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const fields = (typeof error === 'object' && error !== null ? error : {}) as Fields & {
    details?: unknown;
  };
  return new BackendError(toSyncError(error), text(fields.code), text(fields.details));
}

/** The server refused because the team's photos are still stored (`VL008`). */
export const isPhotosRemain = (error: unknown): boolean =>
  error instanceof BackendError && error.raw === 'VL008';

/** Storage has no such object (a photo removed or never uploaded). */
export const isNotFound = (error: unknown): boolean =>
  error instanceof BackendError && error.raw === 'not_found';
