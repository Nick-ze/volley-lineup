// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'coverage/*', '.claude/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description' }],
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
          ],
        },
      ],
    },
  },
]);
