import type { ReactNode } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { swipeStep } from './swipe';

export interface SwipeAreaProps {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

/**
 * Horizontal swipe detection with the gesture-handler v3 hook API. Only activates after
 * 20 px of horizontal movement and fails on vertical movement, so page scrolling still works.
 * Buttons remain the primary, always-available control.
 */
export function SwipeArea({ children, onSwipeLeft, onSwipeRight }: SwipeAreaProps) {
  const pan = usePanGesture({
    runOnJS: true,
    testID: 'rotation-swipe',
    activeOffsetX: [-20, 20],
    failOffsetY: [-20, 20],
    onDeactivate: (e) => {
      const step = swipeStep(e.translationX);
      if (step === 1) onSwipeLeft();
      else if (step === -1) onSwipeRight();
    },
  });
  return <GestureDetector gesture={pan}>{children}</GestureDetector>;
}
