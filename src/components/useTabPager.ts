import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cancelAnimation, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import {
  TAB_COMMIT_FALLBACK_MS,
  TAB_SETTLE_MIN_MS,
  stepTab,
  type SlideDirection,
} from '@/domain/tabMotion';

import { animateTo, callReact } from './pagerWorklets';

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

/**
 * v8.1: the React side of the interactive tab pager (`SwipeTabs`). The drag itself only moves
 * shared values on the UI thread; React state changes just when a neighbour page is needed
 * (lazily), once when a drag goes on to the neighbour, and once when it is over. After a drag went
 * on, the settled neighbour stays in place until the parent shows the new tab; then the content
 * moves back to 0 (showing the new tab) a frame later and the copy is removed after that, so
 * nothing flashes. A flick made meanwhile is queued and runs once the new tab is in place.
 */
export function useTabPager<T>(tabs: readonly T[], index: number, onChange: (next: T) => void) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  /** The side of the mounted (or requested) neighbour, 0 for none. */
  const shownSide = useSharedValue<SlideDirection>(0);
  /** A drag went on: new drags wait until the pager is reset (a flick is queued). */
  const busy = useSharedValue(false);
  const queued = useSharedValue<SlideDirection>(0);
  /** The current touch began in a `NoTabSwipe` area. */
  const blocked = useSharedValue(false);
  /** The tab index, for the gesture worklets. */
  const current = useSharedValue(index);
  const [neighbour, setNeighbour] = useState<PagerNeighbour | null>(null);
  const [commit, setCommit] = useState<PagerCommit | null>(null);
  const latest = useRef({ tabs, onChange, index });
  const shownIndex = useRef(index);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    latest.current = { tabs, onChange, index };
    current.set(index);
  });

  const stopFallback = () => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
  };

  const clear = useCallback(() => {
    stopFallback();
    setNeighbour(null);
    setCommit(null);
    shownSide.set(0);
    busy.set(false);
  }, [shownSide, busy]);

  /** Back to rest at once (the tab didn't change, or another one was chosen). */
  const resetNow = useCallback(() => {
    cancelAnimation(x);
    x.set(0);
    queued.set(0);
    clear();
  }, [x, queued, clear]);

  const showNeighbour = useCallback((next: number, side: SlideDirection) => {
    setNeighbour({ index: next, side });
  }, []);

  const hideNeighbour = useCallback(() => {
    shownSide.set(0);
    setNeighbour(null);
  }, [shownSide]);

  const goTo = useCallback(
    (from: number, to: number) => {
      // Another tab was chosen (a tap) while this drag settled: that choice wins.
      if (latest.current.index !== from) {
        resetNow();
        return;
      }
      setCommit({ from, to });
      latest.current.onChange(latest.current.tabs[to] as T);
      fallback.current = setTimeout(resetNow, TAB_COMMIT_FALLBACK_MS);
    },
    [resetNow],
  );

  /** UI thread: animate to `target` (0 back, ±width on), then commit or hide the neighbour. */
  const settle = useCallback(
    (target: number, duration: number, to: number | null) => {
      'worklet';
      const from = current.value;
      if (to !== null) busy.set(true);
      animateTo(x, target, duration, reduceMotion, () => {
        'worklet';
        if (to === null) callReact(hideNeighbour);
        else callReact(goTo, from, to);
      });
    },
    [current, busy, reduceMotion, x, hideNeighbour, goTo],
  );

  /** The new tab is in place: drop the copy, then run a flick made meanwhile. */
  const landed = useCallback(() => {
    const step = queued.value;
    queued.set(0);
    clear();
    const next = stepTab(latest.current.index, step, latest.current.tabs.length);
    if (next === null) return;
    setNeighbour({ index: next, side: step });
    shownSide.set(step);
    scheduleOnUI(settle, -step * width.value, TAB_SETTLE_MIN_MS, next);
  }, [queued, clear, shownSide, settle, width]);

  // The parent shows the dragged-to tab: move it into place a frame later (its content is mounted
  // by then), then drop the copy. Another tab chosen meanwhile (a tap): back to rest.
  useLayoutEffect(() => {
    if (!commit || index === commit.from) return;
    stopFallback();
    if (index !== commit.to) {
      const frame = requestAnimationFrame(resetNow);
      return () => cancelAnimationFrame(frame);
    }
    let frame = requestAnimationFrame(() => {
      x.set(0);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(landed);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [index, commit, x, landed, resetNow]);

  // A tap while a drag springs back: the old neighbour copy goes at once.
  useLayoutEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    if (commit || !neighbour) return;
    const frame = requestAnimationFrame(resetNow);
    return () => cancelAnimationFrame(frame);
  }, [index, commit, neighbour, resetNow]);

  useEffect(() => stopFallback, []);

  return {
    ...{ x, width, shownSide, busy, queued, blocked, current, neighbour },
    /** The tab now shown was dragged into place: it must not slide in again. */
    instant: commit !== null && commit.to === index,
    showNeighbour,
    settle,
  };
}

export type TabPager = ReturnType<typeof useTabPager>;
