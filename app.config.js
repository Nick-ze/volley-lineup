// Extends app.json. EXPO_BASE_URL is set by the GitHub Pages workflow to "/volley-lineup"
// so the web build works under https://<user>.github.io/volley-lineup/.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
