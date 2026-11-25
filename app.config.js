// Extends app.json.
// - EXPO_BASE_URL is set by the GitHub Pages workflow to "/volley-lineup" so the web build works
//   under https://<user>.github.io/volley-lineup/.
// - android.versionCode is derived from expo.version (1.2.3 → 10203) so every release can be
//   installed as an update over the previous one.
// - v10: extra.supabase = the backend's URL and *publishable* key (public by design, protected
//   by RLS) from supabase/public-config.json (also read by the keepalive workflow).
//   EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY override it (e.g. a self-hosted server).
//   Never put the service_role / secret key here.
const publicConfig = require('./supabase/public-config.json');
function versionCode(version) {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((n) => parseInt(n, 10) || 0);
  return major * 10000 + minor * 100 + patch;
}

module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, versionCode: versionCode(config.version ?? '1.0.0') },
  extra: {
    ...config.extra,
    supabase: {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL || publicConfig.url,
      publishableKey: process.env.EXPO_PUBLIC_SUPABASE_KEY || publicConfig.publishableKey,
    },
  },
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
