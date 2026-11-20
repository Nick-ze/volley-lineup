import { Pressable, StyleSheet, Text } from 'react-native';

import { Court } from '@/components';
import type { CourtPosition } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, radius, touchTarget, typography } from '@/theme';

import { useDrag } from './drag/DragContext';
import { DraggablePlayer } from './drag/DraggablePlayer';
import { zoneFeedback } from './drag/useDropZone';
import type { LineupEditor } from './useLineupEditor';

const playerName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`.trim();

/** The court with six drop slots. Slots with validation errors get a red outline. */
export function LineupCourt({ editor }: { editor: LineupEditor }) {
  const drag = useDrag();
  const { set, selectedId, playerById, pressPlayer, pressTarget, validation } = editor;
  const errorPositions = new Set(validation.errors.flatMap((e) => e.positions ?? []));

  const renderSlot = ({ position }: { position: CourtPosition }) => {
    const player = playerById(set.slots[position]);
    if (player) {
      const name = playerName(player);
      return (
        <DraggablePlayer
          player={player}
          from={{ kind: 'slot', position }}
          selected={selectedId === player.id}
          onPress={() => pressPlayer(player.id)}
          accessibilityLabel={t.lineup.slotLabel(position, `${player.number} ${name}`)}
          testID={`slot-player-${position}`}
        />
      );
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.lineup.slotLabel(position, null)}
        accessibilityHint={selectedId ? t.lineup.slotHintSelected : undefined}
        onPress={() => pressTarget({ kind: 'slot', position })}
        style={[styles.empty, selectedId !== null && styles.emptyArmed]}
        testID={`slot-empty-${position}`}
      >
        <Text style={styles.plus}>+</Text>
      </Pressable>
    );
  };

  return (
    <Court
      testID="lineup-court"
      renderSlot={renderSlot}
      slotRef={(position, view) => drag.registerZone({ kind: 'slot', position }, view)}
      slotStyle={({ position }) => [
        styles.slot,
        errorPositions.has(position) && styles.error,
        zoneFeedback(drag, `slot-${position}`).style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  slot: { borderWidth: 3, borderColor: colors.transparent },
  error: { borderColor: colors.error, borderStyle: 'dashed' },
  empty: {
    width: touchTarget + 12,
    height: touchTarget + 12,
    borderRadius: radius.round,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyArmed: { borderStyle: 'solid', backgroundColor: colors.highlightGlow },
  plus: { ...typography.heading, color: colors.onPrimary },
});
