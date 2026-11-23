import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cancelAnimation, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import {
  NO_PAGE,
  SLIDE_DURATION_MS,
  TAB_COMMIT_FALLBACK_MS,
  TAB_SETTLE_MIN_MS,
  slideStart,
  stepTab,
  type SlideDirection,
} from '@/domain/tabMotion';

import { animateTo, callReact } from './pagerWorklets';

/**
 * v8.1.1: the state of the interactive tab pager (`SwipeTabs`, the app tab bar). Every page near
 * the shown tab stays mounted at its own slot; one shared `position` (in pages, on the UI thread)
 * places them all. A drag moves the position and, once it has settled on the neighbour, tells the
 * parent (`onChange`) — that page is already in place, so the new tab shows without a remount or
 * a reset. A tab chosen by the parent (a tap) slides the position there. React only hears of the
 * page at rest (`rest`, the one in normal flow that gives the pager its height).
 */
export function useTabPager(count: number, index: number, onChange: (next: number) => void) {
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(index);
  const width = useSharedValue(0);
  /** A tap jumping over tabs: the page leaving stands in at `aliasSlot`, beside the target. */
  const aliasPage = useSharedValue(NO_PAGE);
  const aliasSlot = useSharedValue(0);
  /** Where the running tap slide goes. */
  const goal = useSharedValue(index);
  /** A drag went on: new drags wait until the parent shows that tab (a flick is queued). */
  const busy = useSharedValue(false);
  const queued = useSharedValue<SlideDirection>(0);
  /** The current touch began in a `NoTabSwipe` area. */
  const blocked = useSharedValue(false);
  /** The shown tab, for the gesture worklets. */
  const current = useSharedValue(index);
  const [rest, setRest] = useState(index);
  // The neighbours mount a frame after the shown page (it draws first), long before a drag.
  const [ready, setReady] = useState(false);
  const latest = useRef({ index, onChange, count });
  /** The tab a drag went on to, until the parent shows it. */
  const pending = useRef<number | null>(null);
  const shown = useRef(index);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    latest.current = { index, onChange, count };
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const stopFallback = () => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
  };

  /** A move ended at `target`: that page is at rest if it is (still) the shown tab. */
  const arrived = useCallback((target: number) => {
    if (latest.current.index === target) setRest(target);
  }, []);

  /** The parent never showed the dragged-to tab: back to the shown one at once. */
  const resetNow = useCallback(() => {
    stopFallback();
    pending.current = null;
    const shownIndex = latest.current.index;
    cancelAnimation(position);
    position.set(shownIndex);
    aliasPage.set(NO_PAGE);
    busy.set(false);
    queued.set(0);
    setRest(shownIndex);
  }, [position, aliasPage, busy, queued]);

  /** A drag settled on the tab `to`: it is in place, so the parent may show it now. */
  const commit = useCallback(
    (from: number, to: number) => {
      // Another tab was chosen (a tap) while this drag settled: that choice wins.
      if (latest.current.index !== from) return;
      pending.current = to;
      setRest(to);
      latest.current.onChange(to);
      fallback.current = setTimeout(resetNow, TAB_COMMIT_FALLBACK_MS);
    },
    [resetNow],
  );

  /** UI thread: the rest of a drag, to `target` (the shown tab or, with `goOn`, a neighbour). */
  const settle = useCallback(
    (target: number, duration: number, goOn: boolean) => {
      'worklet';
      const from = current.value;
      if (goOn) busy.set(true);
      animateTo(position, target, duration, reduceMotion, () => {
        'worklet';
        if (goOn) callReact(commit, from, target);
        else callReact(arrived, target);
      });
    },
    [current, busy, position, reduceMotion, commit, arrived],
  );

  /** UI thread: a slide to the tab `target` chosen by the parent; it stops a running drag settle. */
  const slideTo = useCallback(
    (target: number) => {
      'worklet';
      cancelAnimation(position);
      busy.set(false);
      queued.set(0);
      // A jump still sliding: finish it at once, then slide on from there.
      if (aliasPage.value !== NO_PAGE) position.set(goal.value);
      const start = slideStart(position.value, target);
      aliasPage.set(start.aliasPage);
      aliasSlot.set(start.aliasSlot);
      position.set(start.start);
      goal.set(target);
      animateTo(position, target, SLIDE_DURATION_MS, reduceMotion, () => {
        'worklet';
        aliasPage.set(NO_PAGE);
        callReact(arrived, target);
      });
    },
    [position, busy, queued, aliasPage, aliasSlot, goal, reduceMotion, arrived],
  );

  // The parent shows another tab: the one a drag went on to (already in place: run a flick made
  // meanwhile), or a tapped one (slide there).
  useLayoutEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    current.set(index);
    stopFallback();
    if (pending.current === index) {
      pending.current = null;
      busy.set(false);
      const next = stepTab(index, queued.value, count);
      queued.set(0);
      if (next !== null) scheduleOnUI(settle, next, TAB_SETTLE_MIN_MS, true);
      return;
    }
    pending.current = null;
    if (index >= 0) scheduleOnUI(slideTo, index);
  }, [index, count, current, busy, queued, settle, slideTo]);

  useEffect(() => stopFallback, []);

  return {
    ...{ position, width, aliasPage, aliasSlot, busy, queued, blocked, current },
    /** The page at rest (in normal flow); the shown tab once a slide to it is over. */
    rest,
    /** The neighbouring pages may mount (a frame after the first render). */
    ready,
    settle,
  };
}

export type TabPager = ReturnType<typeof useTabPager>;
