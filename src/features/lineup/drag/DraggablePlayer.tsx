import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { PlayerChip } from '@/components';
import type { PlayerLocation } from '@/domain/lineupEditing';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { dragActivation } from '@/lib/dragActivation';

import { CHIP_SIZE, DRAG_GHOST_OPACITY } from '../constants';
import { useDrag } from './DragContext';

export interface DraggablePlayerProps {
  player: Player;
  from: PlayerLocation;
  selected: boolean;
  onPress(): void;
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
}

/** A player chip that can be dragged (pan gesture) and tapped (tap-to-select). */
export function DraggablePlayer({
  player,
  from,
  selected,
  onPress,
  size = CHIP_SIZE,
  accessibilityLabel,
  testID,
}: DraggablePlayerProps) {
  const t = useT();
  const drag = useDrag();
  const pan = usePanGesture({
    minDistance: dragActivation.minDistance,
    activateAfterLongPress: dragActivation.activateAfterLongPress,
    runOnJS: true,
    testID: testID ? `drag-${testID}` : undefined,
    onActivate: (e) => drag.begin({ player, from }, e.absoluteX, e.absoluteY),
    onUpdate: (e) => drag.move(e.absoluteX, e.absoluteY),
    onDeactivate: (e) => drag.end(e.absoluteX, e.absoluteY, e.canceled),
  });
  const isDragged = drag.active?.player.id === player.id;

  return (
    <GestureDetector gesture={pan} userSelect="none">
      <View collapsable={false} style={isDragged && styles.ghost}>
        <PlayerChip
          player={player}
          size={size}
          selected={selected}
          onPress={() => {
            if (!drag.justDragged()) onPress();
          }}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={t.lineup.playerHint}
          testID={testID}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ ghost: { opacity: DRAG_GHOST_OPACITY } });
