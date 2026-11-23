import { usePanGesture, type PanGesture } from 'react-native-gesture-handler';
import { cancelAnimation, useSharedValue } from 'react-native-reanimated';

import {
  TAB_SWIPE_ACTIVATION as OFFSET,
  dragCommit,
  dragOffset,
  dragPosition,
  dragSide,
  releaseVelocity,
  settleDuration,
  stepTab,
} from '@/domain/tabMotion';
import { cancelPress } from '@/lib/cancelPress';

import { callReact } from './pagerWorklets';
import type { TabPager as Pager } from './useTabPager';

type PanConfig = Parameters<typeof usePanGesture>[0];

/**
 * v8.1: the pan of the interactive tab pager. Runs on the UI thread: each frame only moves the
 * shared `x` (no React render); React hears of the drag when a neighbour page is needed and once
 * at the end. A drag made while the last one is still going on to its tab doesn't move the page;
 * if it is a flick (or long enough) it is queued and runs once the new tab is in place.
 */
export function usePagerGesture(pager: Pager, count: number, testID: string): PanGesture {
  const { x, width, shownSide, busy, queued, blocked, current, showNeighbour, settle } = pager;
  /** This drag moves the page (it didn't start in a `NoTabSwipe` area or during a commit). */
  const tracking = useSharedValue(false);
  /** Where the content was when the drag took over (a drag may catch a page settling back)… */
  const start = useSharedValue(0);
  /** …and the gesture's translation then. */
  const origin = useSharedValue(0);
  /** When the finger last moved (ms), to tell a flick from a pause before letting go. */
  const lastMove = useSharedValue(0);
  return usePanGesture({
    // Web: vertical touch scrolling stays with the browser; the right-click menu keeps working.
    // The detector's own `touchAction` prop doesn't reach a hook gesture's view; these web-only
    // settings are accepted at runtime (gesture-handler's props white list) but are not in the
    // config type, hence the `as PanConfig`.
    touchAction: 'pan-y',
    enableContextMenu: true,
    testID,
    activeOffsetX: [-OFFSET, OFFSET],
    failOffsetY: [-OFFSET, OFFSET],
    onActivate: (e) => {
      tracking.set(false);
      origin.set(e.translationX);
      if (blocked.value) return;
      // The card under the pointer must not open on release (web mouse).
      callReact(cancelPress);
      if (busy.value) return;
      cancelAnimation(x);
      start.set(x.value);
      tracking.set(true);
    },
    onUpdate: (e) => {
      lastMove.set(Date.now());
      if (!tracking.value || blocked.value) return;
      const offset = start.value + dragOffset(e.translationX, origin.value);
      const side = dragSide(offset);
      const next = stepTab(current.value, side, count);
      if (next !== null && side !== shownSide.value) {
        shownSide.set(side);
        callReact(showNeighbour, next, side);
      }
      x.set(dragPosition(offset, next !== null, width.value));
    },
    onDeactivate: (e) => {
      const velocity = releaseVelocity(e.velocityX, Date.now() - lastMove.value);
      const stopped = e.canceled || blocked.value;
      if (!tracking.value) {
        // During a commit: queue a flick (or a long drag) for when the new tab is in place.
        const offset = dragOffset(e.translationX, origin.value);
        if (busy.value && !stopped) queued.set(dragCommit(offset, velocity, width.value, true));
        return;
      }
      tracking.set(false);
      const offset = start.value + dragOffset(e.translationX, origin.value);
      const next = stepTab(current.value, dragSide(offset), count);
      const step = stopped ? 0 : dragCommit(offset, velocity, width.value, next !== null);
      const target = -step * width.value;
      settle(target, settleDuration(target - x.value, velocity), step === 0 ? null : next);
    },
    onFinalize: () => {
      blocked.set(false);
    },
  } as PanConfig);
}
