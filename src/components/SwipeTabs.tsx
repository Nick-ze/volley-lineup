import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  GestureDetector,
  useNativeGesture,
  usePanGesture,
  type PanGesture,
} from 'react-native-gesture-handler';

import { TAB_SWIPE_ACTIVATION as OFFSET, swipeTarget } from '@/domain/tabMotion';

import { SlideTransition } from './SlideTransition';

/** The tab swipe of the nearest `SwipeTabs` (null outside one). */
const TabSwipeContext = createContext<PanGesture | null>(null);

export interface SwipeTabsProps<T> {
  /** The tabs in their visual order (left to right). */
  tabs: readonly T[];
  value: T;
  onChange: (next: T) => void;
  children: ReactNode;
  /** Gesture test id (`getByGestureTestId`); unique per screen. */
  testID: string;
  /**
   * `grow` (default): content inside a page's ScrollView, at least as tall as the page.
   * `fill`: a whole screen with its own ScrollView, exactly as tall as its parent.
   */
  size?: 'grow' | 'fill';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * v8 (PLAN §31.2): tab content that slides in from the side of the chosen tab and changes tab on
 * a horizontal swipe (left → next, right → previous). The pan only takes over after
 * `TAB_SWIPE_ACTIVATION` px sideways and fails on vertical movement, so scrolling and taps keep
 * working. Inside another `SwipeTabs` only the outer one swipes (this one just slides), so one
 * swipe never changes two things. Areas that need sideways drags themselves sit in `NoTabSwipe`.
 */
export function SwipeTabs<T>(props: SwipeTabsProps<T>) {
  const outer = useContext(TabSwipeContext);
  const index = props.tabs.indexOf(props.value);
  const box = styles[props.size ?? 'grow'];
  const slide = (
    <SlideTransition
      index={index}
      style={[box, props.style]}
      contentStyle={[box, props.contentStyle]}
    >
      {props.children}
    </SlideTransition>
  );
  if (outer) return slide;
  return <SwipeArea {...props}>{slide}</SwipeArea>;
}

function SwipeArea<T>({ tabs, value, onChange, children, testID, size }: SwipeTabsProps<T>) {
  const pan = usePanGesture({
    runOnJS: true,
    testID,
    activeOffsetX: [-OFFSET, OFFSET],
    failOffsetY: [-OFFSET, OFFSET],
    onDeactivate: (e) => {
      if (e.canceled) return;
      const next = swipeTarget(tabs, value, e.translationX, e.velocityX);
      if (next !== null) onChange(next);
    },
  });
  return (
    <TabSwipeContext.Provider value={pan}>
      {/* Web: vertical touch scrolling stays with the browser. */}
      <GestureDetector gesture={pan} touchAction="pan-y">
        <View collapsable={false} style={styles[size ?? 'grow']}>
          {children}
        </View>
      </GestureDetector>
    </TabSwipeContext.Provider>
  );
}

/**
 * Wraps one native view that handles sideways drags itself (a horizontal ScrollView, a text
 * field): while it is touched the tab swipe waits for it, so scrolling a table or selecting
 * text never changes the tab. Outside a `SwipeTabs` it renders the child as it is.
 */
export function NoTabSwipe({ children }: { children: ReactNode }) {
  const tabSwipe = useContext(TabSwipeContext);
  if (!tabSwipe) return children;
  return <Blocker tabSwipe={tabSwipe}>{children}</Blocker>;
}

function Blocker({ tabSwipe, children }: { tabSwipe: PanGesture; children: ReactNode }) {
  const native = useNativeGesture({ block: tabSwipe, disallowInterruption: true });
  return (
    <GestureDetector gesture={native} touchAction="auto" userSelect="auto">
      {children}
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  fill: { flex: 1 },
});
