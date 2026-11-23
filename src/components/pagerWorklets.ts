import { Easing, withTiming, type SharedValue } from 'react-native-reanimated';
import { isRNRuntime, scheduleOnRN } from 'react-native-worklets';

const EASING = Easing.out(Easing.cubic);

/**
 * Calls a React-side function from a worklet: at once where worklets run on the React runtime
 * (web, Jest), else scheduled from the UI thread.
 */
export function callReact<A extends unknown[]>(fn: (...args: A) => void, ...args: A) {
  'worklet';
  if (isRNRuntime()) fn(...args);
  else scheduleOnRN(fn, ...args);
}

/**
 * v8.1: moves the pager's `x` to `target` (ease-out over `duration` ms, or at once with reduce
 * motion), then calls `done` (on the thread it runs on) unless another drag interrupted it.
 */
export function animateTo(
  x: SharedValue<number>,
  target: number,
  duration: number,
  instant: boolean,
  done: () => void,
) {
  'worklet';
  if (instant) {
    x.set(target);
    done();
    return;
  }
  x.set(
    withTiming(target, { duration, easing: EASING }, (finished) => {
      'worklet';
      if (finished) done();
    }),
  );
}
