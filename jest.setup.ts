/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must use require() */
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
/*
 * v8.3: the animation helpers tests check are spies (same behaviour as the mock), and
 * `useReducedMotion` can be switched per test (`jest.mocked(useReducedMotion).mockReturnValue`).
 */
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    useReducedMotion: jest.fn(() => false),
    withSequence: jest.fn(mock.withSequence),
    withTiming: jest.fn(mock.withTiming),
  };
});
/*
 * v8.1.1: the mock's `useSharedValue` makes a new value on every render (the real one keeps it
 * for the component's life). The tab pager keeps its state in shared values across renders, so
 * the mock keeps each value per component instance (tests that spread the mock get this too).
 */
{
  const { useRef } = require('react') as typeof import('react');
  const reanimatedMock = require('react-native-reanimated/mock') as {
    useSharedValue: <V>(init: V) => unknown;
  };
  const freshValue = reanimatedMock.useSharedValue;
  const useKeptSharedValue = <V>(init: V) => {
    const kept = useRef<unknown>(null);
    if (kept.current === null) kept.current = freshValue(init);
    return kept.current;
  };
  reanimatedMock.useSharedValue = useKeptSharedValue;
}
require('react-native-gesture-handler/jestSetup');

// Route-level tests (renderRouter) compile the whole app tree; cold CI runs can exceed 5 s.
jest.setTimeout(30000);

/*
 * v9.0: a fresh app asks which tour to show (`tourMode: null`), and tour tips are popups over the
 * screens. Tests run with "No tour" unless they choose one themselves (the tour's own tests do),
 * so the other tests see the screens as before. Loaded here, in `beforeEach`, so a test file's
 * own `jest.mock` calls apply to the store's imports first.
 */
beforeEach(() => {
  const { useAppStore } = require('@/store/appStore') as typeof import('@/store/appStore');
  useAppStore.setState({ tourMode: 'none', tourSeen: [] });
});
