// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
// Prettier runs as its own step (`npm run format:check`), not inside ESLint (v8.3, faster lint).
const prettierConfig = require('eslint-config-prettier');

/**
 * v10: all backend code lives in `src/lib/sync/` (so a self-hosted server only changes that
 * folder). Everywhere else, `@supabase/*` and the sync module's internals are off limits: import
 * the barrel `@/lib/sync` (commands) or the hooks in `@/store` (status, access).
 */
const BACKEND_PATTERNS = [
  {
    group: ['@supabase/*', 'supabase', '@supabase/**'],
    message: 'Backend code lives in src/lib/sync only: use `@/lib/sync` or the hooks in `@/store`.',
  },
  {
    group: ['@/lib/sync/*', '**/lib/sync/*'],
    message: 'Import the barrel `@/lib/sync`, not its internals.',
  },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      'coverage/*',
      '.claude/*',
      'supabase/functions/*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
      // TypeScript already checks namespace imports; this rule costs ~4 s per lint run.
      'import/namespace': 'off',
    },
  },
  {
    // UI must follow the language setting: read strings with `const t = useT()` from `@/i18n`.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/i18n/**', '**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/i18n/en',
              message: 'Use `const t = useT()` from `@/i18n` so text follows the language setting.',
            },
          ],
          patterns: [
            {
              group: ['@/i18n/en/*', '@/i18n/de', '@/i18n/de/*', '**/i18n/en', '**/i18n/en/*'],
              message: 'Use `const t = useT()` from `@/i18n` so text follows the language setting.',
            },
            ...BACKEND_PATTERNS,
          ],
        },
      ],
    },
  },
  {
    // v10: inside the sync module the backend may be used (the i18n rule still applies).
    files: ['src/lib/sync/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@/i18n/en', message: 'Use `useT()` from `@/i18n`.' }],
          patterns: [
            {
              group: ['@/i18n/en/*', '@/i18n/de', '@/i18n/de/*', '**/i18n/en', '**/i18n/en/*'],
              message: 'Use `useT()` from `@/i18n`.',
            },
          ],
        },
      ],
    },
  },
]);
