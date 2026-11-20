import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

/*
 * Reanimated 4.7 + worklets 0.13 under Jest:
 * - the worklets native module throws when constructed → use the mock worklets ships;
 * - Reanimated's init calls `setCSSEventHandler`, which JSReanimated (used in Jest) throws on →
 *   stub the initializer so `react-native-reanimated/mock` loads.
 * With this, both our own tests and expo-router/testing-library get the real Reanimated mock
 * (instead of `{}`), and gesture-handler v3 hooks work.
 */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated/src/initializers', () => ({
  initializeReanimatedModule: () => {},
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');

// Route-level tests (renderRouter) compile the whole app tree; cold CI runs can exceed 5 s.
jest.setTimeout(30000);
