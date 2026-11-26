/**
 * v10: the backend settings from `extra.supabase`; audit L28: a secret key is never used.
 */
import Constants from 'expo-constants';

import { syncConfig } from '../config';

const URL = 'https://example.supabase.co';

// `expoConfig` is a getter that can't be replaced; its object can be changed (and restored).
const expoConfig = Constants.expoConfig as { extra?: Record<string, unknown> };
const savedExtra = expoConfig.extra;

function withExtra(supabase: unknown) {
  expoConfig.extra = { ...savedExtra, supabase };
}

afterAll(() => {
  expoConfig.extra = savedExtra;
});

describe('syncConfig', () => {
  it('reads the URL and the publishable key', () => {
    withExtra({ url: URL, publishableKey: 'sb_publishable_x' });
    expect(syncConfig()).toEqual({ url: URL, publishableKey: 'sb_publishable_x' });
  });

  it('refuses a secret key, as if nothing were configured (audit L28)', () => {
    withExtra({ url: URL, publishableKey: 'sb_secret_x' });
    expect(syncConfig()).toBeNull();
  });

  it('needs an https URL and a key', () => {
    withExtra({ url: 'http://x', publishableKey: 'sb_publishable_x' });
    expect(syncConfig()).toBeNull();
    withExtra({ url: URL, publishableKey: '' });
    expect(syncConfig()).toBeNull();
    withExtra(null);
    expect(syncConfig()).toBeNull();
  });
});
