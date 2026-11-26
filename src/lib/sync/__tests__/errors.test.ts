import {
  BackendError,
  backendError,
  isPhotosRemain,
  requestCodeError,
  toSyncError,
} from '../errors';

describe('toSyncError', () => {
  it.each([
    [{ code: '42501', message: 'forbidden' }, 'forbidden'],
    [{ code: 'VL001' }, 'lastManager'],
    [{ code: 'VL002' }, 'inviteInvalid'],
    [{ code: 'VL004' }, 'lastMember'],
    [{ code: 'VL006' }, 'tooMany'],
    [{ code: 'VL007' }, 'tooMany'],
    [{ code: 'VL008' }, 'unknown'],
    [{ code: '22023' }, 'unknown'],
    [{ code: '23514' }, 'unknown'],
    [{ code: 'PGRST303', status: 401 }, 'signedOut'],
  ])('maps SQL / PostgREST error %j', (error, code) => {
    expect(toSyncError(error)).toBe(code);
  });

  it.each([
    [new TypeError('Network request failed'), 'offline'],
    [{ name: 'AbortError', message: 'aborted' }, 'offline'],
    [{ message: 'FetchError: failed', code: '', status: 0 }, 'offline'],
    [{ message: 'TypeError: Failed to fetch', code: '' }, 'offline'],
    [{ status: 503, message: 'Service Unavailable' }, 'offline'],
    [{ status: 540, message: 'Project paused' }, 'offline'],
    [{ name: 'AuthRetryableFetchError', status: 0 }, 'offline'],
    // storage-js wraps fetch's own error (before audit L5 any TypeError counted, e.g. 'x').
    [{ name: 'StorageUnknownError', originalError: new TypeError('Failed to fetch') }, 'offline'],
    [new TypeError('Load failed'), 'offline'],
    [new TypeError('NetworkError when attempting to fetch resource.'), 'offline'],
    [new TypeError('Network request failed (HTTP 540)'), 'offline'],
    [{ message: 'TypeError: Network request failed', code: '' }, 'offline'],
    [{ statusCode: '502', message: 'Bad gateway' }, 'offline'],
  ])('a lost connection or a paused / failing server is offline: %j', (error, code) => {
    expect(toSyncError(error)).toBe(code);
  });

  it.each([
    [new TypeError("Cannot read properties of undefined (reading 'id')")],
    [{ name: 'StorageUnknownError', originalError: new TypeError('x is not a function') }],
    [{ message: "TypeError: Cannot read properties of null (reading 'rows')", code: '' }],
  ])('a programming error is not "offline" (audit L5): %j', (error) => {
    expect(toSyncError(error)).toBe('unknown');
  });

  it.each([
    [{ name: 'AuthApiError', code: 'otp_expired', status: 403 }, 'invalidCode'],
    [
      { name: 'AuthApiError', message: 'Token has expired or is invalid', status: 400 },
      'invalidCode',
    ],
    // v10 audit L16: an old auth server's wrong code (403, no error code) is a wrong code.
    [
      { name: 'AuthApiError', message: 'Token has expired or is invalid', status: 403 },
      'invalidCode',
    ],
    [
      { name: 'AuthApiError', message: 'Token has expired or is invalid', status: 401 },
      'invalidCode',
    ],
    [{ code: 'email_address_invalid', status: 400 }, 'emailRejected'],
    [{ code: 'signup_disabled', status: 422 }, 'emailRejected'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'rateLimited'],
    [{ status: 429 }, 'rateLimited'],
    [{ code: 'refresh_token_not_found', status: 400 }, 'signedOut'],
    [{ code: 'session_not_found' }, 'signedOut'],
    [{ name: 'AuthSessionMissingError' }, 'notSignedIn'],
    [{ status: 401 }, 'forbidden'],
    [{ status: 403 }, 'forbidden'],
    [{ status: 400, message: 'bad' }, 'unknown'],
    ['text', 'unknown'],
    [null, 'unknown'],
  ])('maps auth and other errors %j', (error, code) => {
    expect(toSyncError(error)).toBe(code);
  });

  it('keeps a BackendError’s code and raw code', () => {
    const e = new BackendError('lastManager', 'VL001', 't1');
    expect(toSyncError(e)).toBe('lastManager');
    expect(backendError(e)).toBe(e);
    const wrapped = backendError({ code: 'VL008', details: 't1,t2', message: 'photos_remain' });
    expect(wrapped).toMatchObject({ code: 'unknown', raw: 'VL008', detail: 't1,t2' });
    expect(isPhotosRemain(wrapped)).toBe(true);
    expect(isPhotosRemain(new Error('x'))).toBe(false);
    expect(backendError('oops')).toMatchObject({ code: 'unknown', raw: '' });
  });
});

describe('requestCodeError (audit M13)', () => {
  it.each([
    [
      { name: 'AuthRetryableFetchError', message: 'Error sending magic link email', status: 500 },
      'mailFailed',
    ],
    [{ name: 'AuthApiError', code: 'unexpected_failure', status: 500 }, 'mailFailed'],
    [{ name: 'AuthApiError', code: 'validation_failed', status: 400 }, 'emailRejected'],
    [{ name: 'AuthRetryableFetchError', status: 0 }, 'offline'],
    [{ name: 'AuthRetryableFetchError', status: 503 }, 'offline'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'rateLimited'],
    [null, 'unknown'],
  ])('maps a code request’s error %j', (error, code) => {
    expect(requestCodeError(error).code).toBe(code);
  });
});
