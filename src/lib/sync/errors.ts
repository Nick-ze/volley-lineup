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
};

const OFFLINE_NAMES = new Set([
  'TypeError',
  'AbortError',
  'TimeoutError',
  'AuthRetryableFetchError',
  'FetchError',
]);

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
  if (OFFLINE_NAMES.has(name) || /^(TypeError|AbortError|FetchError|TimeoutError):/.test(message)) {
    return 'offline';
  }
  if (e.originalError !== undefined) return toSyncError(e.originalError);
  const status = httpStatus(e);
  if (status === 0 || status >= 500) return 'offline';
  if (status === 429) return 'rateLimited';
  if (status === 401 || status === 403) return 'forbidden';
  if (/token has expired or is invalid/i.test(message)) return 'invalidCode';
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
