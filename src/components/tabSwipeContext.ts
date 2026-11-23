import { createContext } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

/** The tab swipe around some content (a `SwipeTabs` pager or an app tab scene). */
export interface TabSwipe {
  gesture: PanGesture;
  /** Set while the touch began in a `NoTabSwipe` area: that touch never changes the tab. */
  blocked: SharedValue<boolean>;
}

/** The tab swipe of the nearest pager (null outside one): inner `SwipeTabs` only slide. */
export const TabSwipeContext = createContext<TabSwipe | null>(null);
