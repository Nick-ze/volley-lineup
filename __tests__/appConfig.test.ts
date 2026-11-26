/**
 * @jest-environment node
 *
 * v10 audit L28: `app.config.js` refuses to bundle a secret Supabase key.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../app.config.js') as {
  (input: { config: Record<string, unknown> }): { extra: { supabase: { publishableKey: string } } };
  isSecretKey: (key: unknown) => boolean;
};

const jwt = (payload: object) =>
  ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join(
    '.',
  );

describe('app.config.js and secret keys (audit L28)', () => {
  const saved = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_KEY = saved;
  });

  it('tells secret keys from public ones', () => {
    expect(appConfig.isSecretKey('sb_secret_abc')).toBe(true);
    expect(appConfig.isSecretKey(jwt({ role: 'service_role', iss: 'supabase' }))).toBe(true);
    expect(appConfig.isSecretKey('sb_publishable_abc')).toBe(false);
    expect(appConfig.isSecretKey(jwt({ role: 'anon', iss: 'supabase' }))).toBe(false);
    expect(appConfig.isSecretKey('a.b.c')).toBe(false);
    expect(appConfig.isSecretKey(undefined)).toBe(false);
  });

  it('builds with the repository’s publishable key', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_KEY;
    const built = appConfig({ config: { version: '10.0.0' } });
    expect(built.extra.supabase.publishableKey).toMatch(/^sb_publishable_/);
  });

  it.each(['sb_secret_abc', jwt({ role: 'service_role' })])(
    'refuses to build with a secret key in EXPO_PUBLIC_SUPABASE_KEY (%s)',
    (key) => {
      process.env.EXPO_PUBLIC_SUPABASE_KEY = key;
      expect(() => appConfig({ config: { version: '10.0.0' } })).toThrow(/secret/);
    },
  );
});
