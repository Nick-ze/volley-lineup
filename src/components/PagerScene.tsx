import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { makeStyles } from '@/theme';

import { usePageStyle } from './TabPager';
import { TabSwipeContext } from './tabSwipeContext';
import { usePagerGesture } from './usePagerGesture';
import type { TabPager } from './useTabPager';

export interface PagerSceneProps {
  /** The pager shared by all scenes (`useTabPager` in the navigator's layout). */
  pager: TabPager;
  /** This scene's tab index. */
  index: number;
  count: number;
  /** Gesture test id (`getByGestureTestId`). */
  testID: string;
  children: ReactNode;
}

/**
 * v8.1.1: one scene of a navigator whose screens page sideways (the app tab bar). The navigator
 * keeps every scene mounted and stacked; each scene's content sits at its slot for the shared
 * pager position, so a drag moves the real screens and a tab change moves nothing (the navigator
 * only changes which scene is on top). Hiding the unfocused scenes from touch and assistive tech
 * is the navigator's job. Inner `SwipeTabs` only slide, and `NoTabSwipe` areas block this swipe.
 */
export function PagerScene({ pager, index, count, testID, children }: PagerSceneProps) {
  const styles = useStyles();
  const gesture = usePagerGesture(pager, count, testID);
  const place = usePageStyle(pager, index);
  const { blocked } = pager;
  const tabSwipe = useMemo(() => ({ gesture, blocked }), [gesture, blocked]);
  const onLayout = (e: LayoutChangeEvent) => {
    pager.width.set(e.nativeEvent.layout.width);
  };
  return (
    <TabSwipeContext.Provider value={tabSwipe}>
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          style={layout.fill}
          onLayout={onLayout}
          testID={`${testID}-pager`}
        >
          <Animated.View style={[layout.fill, styles.page, place]}>{children}</Animated.View>
        </View>
      </GestureDetector>
    </TabSwipeContext.Provider>
  );
}

const layout = StyleSheet.create({ fill: { flex: 1 } });

// The scenes themselves are transparent (the neighbouring scene shows through while dragging),
// so each page carries the screen background.
const useStyles = makeStyles((theme) => ({
  page: { backgroundColor: theme.colors.background },
}));
