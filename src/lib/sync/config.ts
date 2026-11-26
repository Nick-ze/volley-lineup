/**
 * v10: the backend's public settings from `app.config.js` (`extra.supabase`). Without them the
 * account features are hidden and the app stays local-only.
 */
import Constants from 'expo-constants';

export interface SyncConfig {
  url: string;
  publishableKey: string;
}

export function syncConfig(): SyncConfig | null {
  const value: unknown = Constants.expoConfig?.extra?.supabase;
  if (typeof value !== 'object' || value === null) return null;
  const { url, publishableKey } = value as Record<string, unknown>;
  if (typeof url !== 'string' || typeof publishableKey !== 'string') return null;
  if (!url.startsWith('https://') || publishableKey.length === 0) return null;
  // Never use a secret key, should one have been bundled anyway (v10 audit L28; `app.config.js`
  // refuses to build with one).
  if (publishableKey.startsWith('sb_secret_')) return null;
  return { url, publishableKey };
}

export const isSyncConfigured = (): boolean => syncConfig() !== null;
