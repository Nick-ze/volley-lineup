import { useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, useNativeGesture } from 'react-native-gesture-handler';

import { pagerWindow } from '@/domain/tabMotion';
import { spacing } from '@/theme';

import { SlideTransition } from './SlideTransition';
import { PagerView } from './TabPager';
import { TabSwipeContext, type TabSwipe } from './tabSwipeContext';
import { usePagerGesture } from './usePagerGesture';
import { useTabPager } from './useTabPager';

type NativeConfig = Parameters<typeof useNativeGesture>[0];

export interface SwipeTabsProps<T> {
  /** The tabs in their visual order (left to right); each must give a distinct `String(tab)`. */
  tabs: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /**
   * The content of a tab. v8.1.1: the shown tab and its neighbours are rendered with it and stay
   * mounted (keyed by the tab), so a tab change never remounts a page.
   */
  renderTab: (tab: T) => ReactNode;
  /** Gesture test id (`getByGestureTestId`); unique per screen. */
  testID: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * v8.1: the parent's side padding, which the drag uses so pages slide out to the screen's
   * edges (default: the `Screen` padding).
   */
  bleed?: number;
}

/**
 * v8 (PLAN §31.2): tab content that pages sideways. v8.1: a sideways drag moves it with the
 * finger, the neighbouring tab beside it; released past 35 % of the width or flicked it goes on
 * to that tab, else back. v8.1.1: a real pager — the shown tab and its neighbours stay mounted,
 * so the drag and the tab change never swap or remount a page (no flicker); a tapped tab slides
 * in. The pan only takes over after `TAB_SWIPE_ACTIVATION` px sideways and fails on vertical
 * movement, so scrolling and taps keep working. Inside another pager only the outer one swipes
 * (this one just slides), so one drag never changes two things. Areas that need sideways drags
 * themselves sit in `NoTabSwipe`.
 */
export function SwipeTabs<T>(props: SwipeTabsProps<T>) {
  const outer = useContext(TabSwipeContext);
  if (outer || !props.tabs.includes(props.value)) return <Slide {...props} />;
  return <SwipeArea {...props} />;
}

function Slide<T>(props: SwipeTabsProps<T>) {
  return (
    <SlideTransition
      index={props.tabs.indexOf(props.value)}
      style={[styles.grow, props.style]}
      contentStyle={[styles.grow, props.contentStyle]}
      testID={`${props.testID}-slide`}
    >
      {props.renderTab(props.value)}
    </SlideTransition>
  );
}

function SwipeArea<T>(props: SwipeTabsProps<T>) {
  const { tabs, value, onChange, renderTab, testID } = props;
  const index = tabs.indexOf(value);
  const pager = useTabPager(tabs.length, index, (next) => onChange(tabs[next] as T));
  const gesture = usePagerGesture(pager, tabs.length, testID);
  const { blocked } = pager;
  const tabSwipe = useMemo(() => ({ gesture, blocked }), [gesture, blocked]);
  const pages = pagerWindow(index, pager.rest, tabs.length, pager.ready).map((i) => {
    const tab = tabs[i] as T;
    return { key: String(tab), index: i, content: renderTab(tab) };
  });
  return (
    <TabSwipeContext.Provider value={tabSwipe}>
      <PagerView
        pager={pager}
        gesture={gesture}
        pages={pages}
        index={index}
        style={[styles.grow, props.style]}
        bleed={props.bleed ?? spacing.lg}
        contentStyle={props.contentStyle}
        testID={testID}
      />
    </TabSwipeContext.Provider>
  );
}

/**
 * Wraps one native view that handles sideways drags itself (a horizontal ScrollView, a text
 * field): a touch that starts on it never changes the tab, so scrolling a table or selecting
 * text works as before. Outside a pager it renders the child as it is.
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

// Content inside a page's ScrollView, at least as tall as the page.
const styles = StyleSheet.create({ grow: { flexGrow: 1 } });
