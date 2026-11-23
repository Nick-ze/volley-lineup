import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { isRNRuntime, scheduleOnRN } from 'react-native-worklets';

import { TAB_COMMIT_FALLBACK_MS, type SlideDirection } from '@/domain/tabMotion';

/** The neighbouring page a drag shows: its tab index and side (1 right, -1 left). */
export interface PagerNeighbour {
  index: number;
  side: SlideDirection;
}

/** A drag that went on to the neighbour: from the tab `from` to the tab `to`. */
interface PagerCommit {
  from: number;
  to: number;
}

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
 * v8.1: the React side of the interactive tab pager (`SwipeTabs`). The drag itself only moves
 * shared values on the UI thread; React state changes just when a neighbour page is needed
 * (lazily, when the drag direction changes), once when a drag goes on to the neighbour, and once
 * when it is over. After a drag went on, the settled neighbour stays in place until the parent
 * shows the new tab; then the content moves back to 0 (showing the new tab) a frame later and
 * the neighbour is removed after that, so nothing flashes or jumps.
 */
export function useTabPager<T>(tabs: readonly T[], index: number, onChange: (next: T) => void) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  /** The side of the mounted (or requested) neighbour, 0 for none. */
  const shownSide = useSharedValue<SlideDirection>(0);
  /** A drag went on: new drags wait until the pager is reset. */
  const busy = useSharedValue(false);
  /** The current touch began in a `NoTabSwipe` area. */
  const blocked = useSharedValue(false);
  /** The tab index, for the gesture worklets. */
  const current = useSharedValue(index);
  const [neighbour, setNeighbour] = useState<PagerNeighbour | null>(null);
  const [commit, setCommit] = useState<PagerCommit | null>(null);
  const latest = useRef({ tabs, onChange });
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    latest.current = { tabs, onChange };
    current.set(index);
  });

  const clear = useCallback(() => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    setNeighbour(null);
    setCommit(null);
    shownSide.set(0);
    busy.set(false);
  }, [shownSide, busy]);

  /** Back to rest at once (the tab didn't change, or another one was chosen). */
  const resetNow = useCallback(() => {
    cancelAnimation(x);
    x.set(0);
    clear();
  }, [x, clear]);

  const showNeighbour = useCallback((next: number, side: SlideDirection) => {
    setNeighbour({ index: next, side });
  }, []);

  const hideNeighbour = useCallback(() => {
    shownSide.set(0);
    setNeighbour(null);
  }, [shownSide]);

  const goTo = useCallback(
    (from: number, to: number) => {
      setCommit({ from, to });
      const { tabs: all, onChange: change } = latest.current;
      change(all[to] as T);
      fallback.current = setTimeout(resetNow, TAB_COMMIT_FALLBACK_MS);
    },
    [resetNow],
  );

  // The parent shows the dragged-to tab: move it into place a frame later (its content is mounted
  // by then), then drop the copy. Another tab chosen meanwhile (a tap): back to rest.
  useLayoutEffect(() => {
    if (!commit || index === commit.from) return;
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    if (index !== commit.to) {
      const frame = requestAnimationFrame(resetNow);
      return () => cancelAnimationFrame(frame);
    }
    let frame = requestAnimationFrame(() => {
      x.set(0);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(clear);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [index, commit, x, clear, resetNow]);

  useEffect(
    () => () => {
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );

  /** UI thread: animate to `target` (0 back, ±width on), then commit or hide the neighbour. */
  const settle = useCallback(
    (target: number, duration: number, to: number | null) => {
      'worklet';
      const from = current.value;
      const done = () => {
        'worklet';
        if (to === null) callReact(hideNeighbour);
        else callReact(goTo, from, to);
      };
      if (to !== null) busy.set(true);
      if (reduceMotion) {
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
    },
    [current, busy, reduceMotion, x, hideNeighbour, goTo],
  );

  return {
    x,
    width,
    shownSide,
    busy,
    blocked,
    current,
    neighbour,
    /** The tab now shown was dragged into place: it must not slide in again. */
    instant: commit !== null && commit.to === index,
    showNeighbour,
    settle,
  };
}

export type TabPager = ReturnType<typeof useTabPager>;
