// Extends app.json.
// - EXPO_BASE_URL is set by the GitHub Pages workflow to "/volley-lineup" so the web build works
//   under https://<user>.github.io/volley-lineup/.
// - android.versionCode is derived from expo.version (1.2.3 → 10203) so every release can be
//   installed as an update over the previous one.
function versionCode(version) {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((n) => parseInt(n, 10) || 0);
  return major * 10000 + minor * 100 + patch;
}

module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, versionCode: versionCode(config.version ?? '1.0.0') },
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
