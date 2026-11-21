import { Pressable, StyleSheet, Text } from 'react-native';

import { Court } from '@/components';
import type { CourtPosition } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, typography } from '@/theme';

import { COMPACT_SLOT_MIN_HEIGHT, EMPTY_SLOT_SIZE } from './constants';
import { CourtPlayerSpot } from './CourtPlayerSpot';
import { useDrag } from './drag/DragContext';
import { zoneFeedback } from './drag/useDropZone';
import type { LineupDraft } from './useLineupDraft';

/**
 * The court with six drop slots. Slots with validation errors get a red outline. Each starter
 * shows the role of their spot on top (v6: the formation decides the roles).
 */
export function LineupCourt({
  editor,
  compact = false,
}: {
  editor: LineupDraft;
  compact?: boolean;
}) {
  const t = useT();
  const drag = useDrag();
  const { set, selectedId, playerById, pressTarget, validation } = editor;
  // Empty slots already look empty, so INCOMPLETE is only listed in the panel, not outlined.
  const errorPositions = new Set(
    validation.errors.filter((e) => e.code !== 'INCOMPLETE').flatMap((e) => e.positions ?? []),
  );

  const renderSlot = ({ position }: { position: CourtPosition }) => {
    const player = playerById(set.slots[position]);
    if (player) {
      return (
        <CourtPlayerSpot
          editor={editor}
          player={player}
          position={position}
          compact={compact}
          onRolePress={(p) => editor.pressPlayer(p.id)}
        />
      );
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.lineup.slotLabel(position, null)}
        accessibilityHint={selectedId ? t.lineup.slotHintSelected : undefined}
        disabled={editor.locked}
        accessibilityState={{ disabled: editor.locked }}
        aria-disabled={editor.locked}
        onPress={() => pressTarget({ kind: 'slot', position })}
        style={[styles.empty, selectedId !== null && styles.emptyArmed]}
        testID={`slot-empty-${position}`}
      >
        <Text style={styles.plus}>{t.lineup.emptySlotGlyph}</Text>
      </Pressable>
    );
  };

  return (
    <>
      <Court
        testID="lineup-court"
        renderSlot={renderSlot}
        slotRef={(position, view) => drag.registerZone({ kind: 'slot', position }, view)}
        slotStyle={({ position }) => [
          styles.slot,
          compact && styles.compactSlot,
          errorPositions.has(position) && styles.error,
          zoneFeedback(drag, `slot-${position}`).style,
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  slot: { borderWidth: 3, borderColor: colors.transparent },
  compactSlot: { minHeight: COMPACT_SLOT_MIN_HEIGHT, paddingVertical: 0 },
  error: { borderColor: colors.error, borderStyle: 'dashed' },
  empty: {
    width: EMPTY_SLOT_SIZE,
    height: EMPTY_SLOT_SIZE,
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
