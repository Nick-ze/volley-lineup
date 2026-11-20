/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Reanimated 4 / Worklets ship a resolver that picks their JS (non-native) builds under Jest;
  // without it, importing reanimated (e.g. via gesture-handler v3 hooks) crashes.
  resolver: 'react-native-reanimated/jest/resolver',
  // Route-level tests (renderRouter) transform the whole app on a cold cache; 5 s is too tight.
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/', '<rootDir>/dist/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/', '<rootDir>/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nanoid|zustand|standard-navigation)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/i18n/**'],
  coverageThreshold: {
    './src/domain/': { statements: 100, branches: 100, functions: 100, lines: 100 },
  },
};
