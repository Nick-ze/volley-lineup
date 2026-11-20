import type { ReactNode } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { SWIPE_ACTIVATION_OFFSET as OFFSET } from './layout';
import { swipeStep } from './swipe';

export interface SwipeAreaProps {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

/**
 * Horizontal swipe detection with the gesture-handler v3 hook API. Only activates after
 * `SWIPE_ACTIVATION_OFFSET` px of horizontal movement and fails on vertical movement, so page scrolling still works.
 * Buttons remain the primary, always-available control.
 */
export function SwipeArea({ children, onSwipeLeft, onSwipeRight }: SwipeAreaProps) {
  const pan = usePanGesture({
    runOnJS: true,
    testID: 'rotation-swipe',
    activeOffsetX: [-OFFSET, OFFSET],
    failOffsetY: [-OFFSET, OFFSET],
    onDeactivate: (e) => {
      const step = swipeStep(e.translationX);
      if (step === 1) onSwipeLeft();
      else if (step === -1) onSwipeRight();
    },
  });
  return <GestureDetector gesture={pan}>{children}</GestureDetector>;
}
