import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { PlayerChip } from '@/components';
import type { Player } from '@/domain/types';

import { DRAG_CHIP_SIZE } from '../constants';

/** The "lifted" chip that follows the pointer while dragging (scaled up, yellow glow). */
export function DragOverlay({
  player,
  x,
  y,
}: {
  player: Player;
  x: SharedValue<number>;
  y: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - DRAG_CHIP_SIZE / 2 },
      { translateY: y.value - DRAG_CHIP_SIZE / 2 },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, style]} testID="drag-overlay">
      <PlayerChip player={player} size={DRAG_CHIP_SIZE} lifted showName={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, top: 0, zIndex: 10 },
});
