import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { makeInert } from '@/lib/inert';

import type { TabPager as Pager } from './useTabPager';

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
