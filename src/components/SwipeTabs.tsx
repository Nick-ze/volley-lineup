import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, useNativeGesture, type PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import { spacing } from '@/theme';

import { SlideTransition } from './SlideTransition';
import { PagerView, usePagerGesture } from './TabPager';
import { useTabPager } from './useTabPager';

interface TabSwipe {
  gesture: PanGesture;
  /** Set while the touch began in a `NoTabSwipe` area: that touch never changes the tab. */
  blocked: SharedValue<boolean>;
}

type NativeConfig = Parameters<typeof useNativeGesture>[0];

/** The tab swipe of the nearest `SwipeTabs` (null outside one). */
const TabSwipeContext = createContext<TabSwipe | null>(null);

export interface SwipeTabsProps<T> {
  /** The tabs in their visual order (left to right). */
  tabs: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** The current tab's content (default: `renderTab(value)`). */
  children?: ReactNode;
  /**
   * v8.1: the content of any tab, for the neighbouring page a drag shows beside the current one
   * (mounted only while a drag shows it): it should look like the current page for that tab.
   */
  renderTab: (tab: T) => ReactNode;
  /** Gesture test id (`getByGestureTestId`); unique per screen. */
  testID: string;
  /**
   * `grow` (default): content inside a page's ScrollView, at least as tall as the page.
   * `fill`: a whole screen with its own ScrollView, exactly as tall as its parent.
   */
  size?: 'grow' | 'fill';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * v8.1: the parent's side padding, which the drag uses so pages slide out to the screen's
   * edges (default: the `Screen` padding for `grow`, none for `fill`).
   */
  bleed?: number;
}

/**
 * v8 (PLAN §31.2): tab content that slides in from the side of the chosen tab. v8.1: a sideways
 * drag moves it with the finger, the neighbouring tab beside it (an interactive pager); released
 * past a third of the width or flicked it goes on to that tab, else back. The pan only takes over
 * after `TAB_SWIPE_ACTIVATION` px sideways and fails on vertical movement, so scrolling and taps
 * keep working. Inside another `SwipeTabs` only the outer one swipes (this one just slides), so
 * one drag never changes two things. Areas that need sideways drags themselves sit in `NoTabSwipe`.
 */
export function SwipeTabs<T>(props: SwipeTabsProps<T>) {
  const outer = useContext(TabSwipeContext);
  if (outer) return <Slide {...props} />;
  return <SwipeArea {...props} />;
}

function Slide<T>(props: SwipeTabsProps<T> & { instant?: boolean }) {
  const box = styles[props.size ?? 'grow'];
  return (
    <SlideTransition
      index={props.tabs.indexOf(props.value)}
      instant={props.instant}
      style={[box, props.style]}
      contentStyle={[box, props.contentStyle]}
      testID={`${props.testID}-slide`}
    >
      {props.children ?? props.renderTab(props.value)}
    </SlideTransition>
  );
}

function SwipeArea<T>(props: SwipeTabsProps<T>) {
  const { tabs, value, onChange, renderTab, testID } = props;
  const pager = useTabPager(tabs, tabs.indexOf(value), onChange);
  const gesture = usePagerGesture(pager, tabs.length, testID);
  return (
    <TabSwipeContext.Provider value={{ gesture, blocked: pager.blocked }}>
      <PagerView
        pager={pager}
        gesture={gesture}
        neighbour={pager.neighbour ? renderTab(tabs[pager.neighbour.index] as T) : null}
        style={styles[props.size ?? 'grow']}
        bleed={props.bleed ?? (props.size === 'fill' ? 0 : spacing.lg)}
        contentStyle={props.contentStyle}
        testID={testID}
      >
        <Slide {...props} instant={pager.instant} />
      </PagerView>
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
  const { gesture, blocked } = tabSwipe;
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
      blocked.set(true);
    },
  } as NativeConfig);
  return <GestureDetector gesture={native}>{children}</GestureDetector>;
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  fill: { flex: 1 },
});
