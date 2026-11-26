/**
 * v10 audit L33: the URL polyfill and supabase-js are loaded when the client is first needed,
 * not when the app starts (users without an account never load them on a phone).
 */
let mockLoaded: string[] = [];

jest.mock('@supabase/supabase-js', () => {
  mockLoaded.push('supabase-js');
  return {
    createClient: jest.fn(() => ({
      auth: { startAutoRefresh: jest.fn(async () => undefined), stopAutoRefresh: jest.fn() },
    })),
  };
});
jest.mock('../polyfill', () => {
  mockLoaded.push('polyfill');
  return {};
});
jest.mock('../config', () => ({
  syncConfig: () => ({ url: 'https://abcdef.supabase.co', publishableKey: 'sb_publishable_x' }),
}));

describe('loading the backend client (audit L33)', () => {
  beforeEach(() => {
    mockLoaded = [];
    jest.resetModules();
  });

  it('importing the client loads neither; the stored session is read without them', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require('../client') as typeof import('../client');
    expect(await client.hasStoredSession()).toBe(false);
    expect(mockLoaded).toEqual([]);
    client.getClient();
    expect(mockLoaded).toEqual(['polyfill', 'supabase-js']);
  });

  it('the session key matches what `URL` would give, without `URL`', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { authStorageKey } = require('../client') as typeof import('../client');
    for (const url of [
      'https://qzeergfqfwovcvdarwua.supabase.co',
      'https://abcdef.supabase.co/',
      'https://sync.example.org:8443/base?x=1',
      'http://localhost:54321',
    ]) {
      const expected = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
      expect(authStorageKey({ url, publishableKey: 'k' })).toBe(expected);
    }
  });
});
