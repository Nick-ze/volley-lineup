// Extends app.json.
// - EXPO_BASE_URL is set by the GitHub Pages workflow to "/volley-lineup" so the web build works
//   under https://<user>.github.io/volley-lineup/.
// - android.versionCode is derived from expo.version (1.2.3 → 10203) so every release can be
//   installed as an update over the previous one.
// - v10: extra.supabase = the backend's URL and *publishable* key (public by design, protected
//   by RLS) from supabase/public-config.json (also read by the keepalive workflow).
//   EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY override it (e.g. a self-hosted server).
//   Never put the service_role / secret key here.
const { Buffer } = require('node:buffer');

const publicConfig = require('./supabase/public-config.json');

/**
 * v10 audit L28: a key that must never be bundled: a secret key (`sb_secret_…`) or a legacy JWT
 * key whose role is `service_role`. The publishable key (`sb_publishable_…`) and the legacy
 * `anon` JWT are public by design.
 */
function isSecretKey(key) {
  if (typeof key !== 'string') return false;
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload !== null && typeof payload === 'object' && payload.role === 'service_role';
  } catch {
    return false;
  }
}

function publishableKey() {
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY || publicConfig.publishableKey;
  if (isSecretKey(key)) {
    throw new Error(
      'app.config.js: EXPO_PUBLIC_SUPABASE_KEY / supabase/public-config.json hold a secret ' +
        '(service_role) key. It would be bundled into the app: use the publishable key.',
    );
  }
  return key;
}
function versionCode(version) {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((n) => parseInt(n, 10) || 0);
  return major * 10000 + minor * 100 + patch;
}

const appConfig = ({ config }) => ({
  ...config,
  android: { ...config.android, versionCode: versionCode(config.version ?? '1.0.0') },
  extra: {
    ...config.extra,
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL || publicConfig.url,
      publishableKey: publishableKey(),
    },
  },
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});

module.exports = appConfig;
module.exports.isSecretKey = isSecretKey;
