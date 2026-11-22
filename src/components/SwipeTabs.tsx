import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  GestureDetector,
  useNativeGesture,
  usePanGesture,
  type PanGesture,
} from 'react-native-gesture-handler';

import { TAB_SWIPE_ACTIVATION as OFFSET, swipeTarget } from '@/domain/tabMotion';

import { SlideTransition } from './SlideTransition';

interface TabSwipe {
  gesture: PanGesture;
  /** Set while the touch began in a `NoTabSwipe` area: that touch never changes the tab. */
  blockedRef: RefObject<boolean>;
}

type PanConfig = Parameters<typeof usePanGesture>[0];
type NativeConfig = Parameters<typeof useNativeGesture>[0];

/** The tab swipe of the nearest `SwipeTabs` (null outside one). */
const TabSwipeContext = createContext<TabSwipe | null>(null);

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
      testID={`${props.testID}-slide`}
    >
      {props.children}
    </SlideTransition>
  );
  if (outer) return slide;
  return <SwipeArea {...props}>{slide}</SwipeArea>;
}

function SwipeArea<T>({ tabs, value, onChange, children, testID, size }: SwipeTabsProps<T>) {
  const blockedRef = useRef(false);
  const pan = usePanGesture({
    // Web: vertical touch scrolling stays with the browser; the right-click menu keeps working.
    // The detector's own `touchAction` prop doesn't reach a hook gesture's view; these web-only
    // settings are accepted at runtime (gesture-handler's props white list) but are not in the
    // config type, hence the `as PanConfig`.
    touchAction: 'pan-y',
    enableContextMenu: true,
    runOnJS: true,
    testID,
    activeOffsetX: [-OFFSET, OFFSET],
    failOffsetY: [-OFFSET, OFFSET],
    onDeactivate: (e) => {
      if (e.canceled || blockedRef.current) return;
      const next = swipeTarget(tabs, value, e.translationX, e.velocityX);
      if (next !== null) onChange(tabs[next] as T);
    },
    onFinalize: () => {
      blockedRef.current = false;
    },
  } as PanConfig);
  return (
    <TabSwipeContext.Provider value={{ gesture: pan, blockedRef }}>
      <GestureDetector gesture={pan}>
        <View collapsable={false} style={styles[size ?? 'grow']}>
          {children}
        </View>
      </GestureDetector>
    </TabSwipeContext.Provider>
  );
}

/**
 * Wraps one native view that handles sideways drags itself (a horizontal ScrollView, a text
 * field): a touch that starts on it never changes the tab, so scrolling a table or selecting
 * text works as before. Outside a `SwipeTabs` it renders the child as it is.
 */
export function NoTabSwipe({ children, testID }: { children: ReactNode; testID?: string }) {
  const tabSwipe = useContext(TabSwipeContext);
  if (!tabSwipe) return children;
  return (
    <Blocker tabSwipe={tabSwipe} testID={testID}>
      {children}
    </Blocker>
  );
}

function Blocker({
  tabSwipe,
  children,
  testID,
}: {
  tabSwipe: TabSwipe;
  children: ReactNode;
  testID?: string;
}) {
  const { gesture, blockedRef } = tabSwipe;
  // `block`: the tab swipe waits while this view scrolls (phones). The flag also covers a drag
  // that doesn't scroll (a mouse on web, a table that fits): the swipe may end, but is ignored.
  const native = useNativeGesture({
    // Web: a table / text field keeps the browser's own scrolling and text selection.
    touchAction: 'auto',
    userSelect: 'auto',
    block: gesture,
    disallowInterruption: true,
    runOnJS: true,
    testID,
    onBegin: () => {
      blockedRef.current = true;
    },
  } as NativeConfig);
  return <GestureDetector gesture={native}>{children}</GestureDetector>;
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  fill: { flex: 1 },
});
