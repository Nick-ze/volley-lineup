import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Court, RoleTag } from '@/components';
import { spotRole } from '@/domain/roles';
import type { CourtPosition } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { COMPACT_CHIP_SIZE, COMPACT_SLOT_MIN_HEIGHT, EMPTY_SLOT_SIZE } from './constants';
import { CourtPlayerSpot } from './CourtPlayerSpot';
import { useDrag } from './drag/DragContext';
import { zoneFeedback } from './drag/useDropZone';
import type { LineupDraft } from './useLineupDraft';

/**
 * The court with six drop slots. Slots with validation errors get a red outline. Every spot
 * shows its role on top, filled or empty (v6: the formation decides the roles).
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
    const role = spotRole(set.formation, position);
    const size = compact ? COMPACT_CHIP_SIZE : EMPTY_SLOT_SIZE;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.lineup.emptySlotLabel(position, role, t.positions[role])}
        accessibilityHint={selectedId ? t.lineup.slotHintSelected : undefined}
        disabled={editor.locked}
        accessibilityState={{ disabled: editor.locked }}
        aria-disabled={editor.locked}
        onPress={() => pressTarget({ kind: 'slot', position })}
        style={styles.emptySpot}
        testID={`slot-empty-${position}`}
      >
        <View style={styles.tagArea}>
          <RoleTag role={role} testID={`role-tag-${position}`} />
        </View>
        <View
          style={[
            styles.empty,
            { width: size, height: size },
            selectedId !== null && styles.emptyArmed,
          ]}
        >
          <Text style={styles.plus}>{t.lineup.emptySlotGlyph}</Text>
        </View>
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
  emptySpot: { alignItems: 'center' },
  // Same height as a filled spot's role tag button, so tags and chips line up in a row.
  tagArea: {
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xxs,
  },
  empty: {
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
