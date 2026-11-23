import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  SLIDE_DURATION_MS,
  SLIDE_START_OPACITY,
  slideDirection,
  slideOffset,
} from '@/domain/tabMotion';

export interface SlideTransitionProps {
  /** Index of the shown tab: when it changes, the content slides in from that side. */
  index: number;
  children: ReactNode;
  /**
   * The index shown before this transition was mounted (for content that is remounted with
   * its transition, e.g. keyed by the tab): the first index slides in from that side.
   */
  fromIndex?: number | null;
  /** The outer box (e.g. `flex: 1`). */
  style?: StyleProp<ViewStyle>;
  /**
   * Clip the content while it is beside its place (default true). Off where something may be
   * dragged out of the box (the lineup builder's lifted chip).
   */
  clip?: boolean;
  /** The moving content box (e.g. a `gap`). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  /** v8.1: the new index is already in place (dragged there): change without a slide. */
  instant?: boolean;
}

const EASING = Easing.out(Easing.cubic);

/**
 * v8 (PLAN §31.2): content that slides in (and fades in) from the side of the chosen tab: a tab
 * to the right of the old one comes from the right. Never blocks taps (no pointer lock); with the
 * OS "reduce motion" setting the change is instant.
 */
export function SlideTransition({
  index,
  children,
  fromIndex = null,
  style,
  contentStyle,
  clip = true,
  testID,
  instant = false,
}: SlideTransitionProps) {
  const reduceMotion = useReducedMotion();
  const lastRef = useRef<number | null>(fromIndex);
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const opacity = useSharedValue(1);

  useLayoutEffect(() => {
    const previous = lastRef.current;
    lastRef.current = index;
    const direction = previous === null ? 0 : slideDirection(previous, index);
    if (direction === 0 || reduceMotion || instant) return;
    const timing = { duration: SLIDE_DURATION_MS, easing: EASING };
    x.value = withSequence(
      withTiming(slideOffset(direction, width), { duration: 0 }),
      withTiming(0, timing),
    );
    opacity.value = withSequence(
      withTiming(SLIDE_START_OPACITY, { duration: 0 }),
      withTiming(1, timing),
    );
    // Only a new index starts a slide (not a new width or a re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }],
  }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={[clip && styles.clip, style]} onLayout={onLayout} testID={testID}>
      <Animated.View style={[styles.content, contentStyle, animated]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { flexGrow: 1 },
});
