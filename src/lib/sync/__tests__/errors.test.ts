import { BackendError, backendError, isPhotosRemain, toSyncError } from '../errors';

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
    [{ name: 'StorageUnknownError', originalError: new TypeError('x') }, 'offline'],
    [{ statusCode: '502', message: 'Bad gateway' }, 'offline'],
  ])('a lost connection or a paused / failing server is offline: %j', (error, code) => {
    expect(toSyncError(error)).toBe(code);
  });

  it.each([
    [{ name: 'AuthApiError', code: 'otp_expired', status: 403 }, 'invalidCode'],
    [
      { name: 'AuthApiError', message: 'Token has expired or is invalid', status: 400 },
      'invalidCode',
    ],
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
