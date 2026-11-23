import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, usePanGesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

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
import { makeInert } from '@/lib/inert';

import { callReact, type TabPager as Pager } from './useTabPager';

type PanConfig = Parameters<typeof usePanGesture>[0];

/**
 * v8.1: the pan of the interactive tab pager. Runs on the UI thread: each frame only moves the
 * shared `x` (no React render); React hears of the drag when a neighbour page is needed and once
 * at the end.
 */
export function usePagerGesture(pager: Pager, count: number, testID: string): PanGesture {
  const { x, width, shownSide, busy, blocked, current, showNeighbour, settle } = pager;
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
      if (busy.value) return;
      cancelAnimation(x);
      start.set(x.value);
      origin.set(e.translationX);
      // The card under the pointer must not open on release (web mouse).
      callReact(cancelPress);
    },
    onUpdate: (e) => {
      if (busy.value || blocked.value) return;
      const offset = start.value + dragOffset(e.translationX, origin.value);
      const side = dragSide(offset);
      const next = stepTab(current.value, side, count);
      if (next !== null && side !== shownSide.value) {
        shownSide.set(side);
        callReact(showNeighbour, next, side);
      }
      x.set(dragPosition(offset, next !== null, width.value));
      lastMove.set(Date.now());
    },
    onDeactivate: (e) => {
      if (busy.value) return;
      const offset = start.value + dragOffset(e.translationX, origin.value);
      const next = stepTab(current.value, dragSide(offset), count);
      const velocity = releaseVelocity(e.velocityX, Date.now() - lastMove.value);
      const step =
        e.canceled || blocked.value ? 0 : dragCommit(offset, velocity, width.value, next !== null);
      const target = -step * width.value;
      settle(target, settleDuration(target - x.value, velocity), step === 0 ? null : next);
    },
    onFinalize: () => {
      blocked.set(false);
    },
  } as PanConfig);
}

export interface PagerViewProps {
  pager: Pager;
  gesture: PanGesture;
  /** The current page (`SwipeTabs`'s slide). */
  children: ReactNode;
  /** The neighbouring page while a drag shows it. */
  neighbour: ReactNode;
  style: StyleProp<ViewStyle>;
  contentStyle: StyleProp<ViewStyle>;
  /** The parent's side padding: the pager reaches into it, so pages slide out to its edges. */
  bleed: number;
  testID: string;
}

/**
 * The pager's views: the clipped box (reaching into the parent's side padding), the current page
 * moving with the drag, and the neighbour one box width beside it (absolutely placed, so it never changes the box's height; a taller
 * neighbour is clipped while it is dragged in).
 */
export function PagerView({ pager, gesture, children, neighbour, ...props }: PagerViewProps) {
  const { x, width } = pager;
  const side = pager.neighbour?.side ?? 0;
  const page = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const beside = useAnimatedStyle(
    () => ({ transform: [{ translateX: x.value + side * width.value }] }),
    [side],
  );
  const edges = { left: props.bleed, right: props.bleed };
  const onLayout = (e: LayoutChangeEvent) => {
    width.set(e.nativeEvent.layout.width);
  };
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={[
          styles.clip,
          { marginHorizontal: -props.bleed, paddingHorizontal: props.bleed },
          props.style,
        ]}
        onLayout={onLayout}
        testID={`${props.testID}-pager`}
      >
        <Animated.View style={[props.style, page]}>{children}</Animated.View>
        {pager.neighbour ? (
          <Animated.View
            style={[styles.neighbour, edges, beside]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            testID={`${props.testID}-neighbour`}
          >
            <View ref={makeInert} style={[styles.content, props.contentStyle]}>
              {neighbour}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  neighbour: { position: 'absolute', top: 0, bottom: 0 },
  content: { flexGrow: 1 },
});
