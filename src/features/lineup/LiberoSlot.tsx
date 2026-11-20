import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n/en';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { DraggablePlayer } from './drag/DraggablePlayer';
import { useDropZone } from './drag/useDropZone';
import type { LineupEditor } from './useLineupEditor';

/** The libero spot next to the court: a drop zone holding at most one player. */
export function LiberoSlot({ editor }: { editor: LineupEditor }) {
  const { set, selectedId, playerById, pressPlayer, pressTarget, validation } = editor;
  const { onRef: zoneRef, style: zoneStyle } = useDropZone({ kind: 'libero' });
  const libero = playerById(set.liberoId);
  const hasError = validation.errors.some((e) => e.code === 'LIBERO_ON_COURT');

  return (
    <View
      ref={zoneRef}
      collapsable={false}
      style={[styles.box, hasError && styles.error, zoneStyle]}
      testID="libero-slot"
    >
      <Text style={styles.title}>{t.lineup.libero}</Text>
      {libero ? (
        <DraggablePlayer
          player={libero}
          from={{ kind: 'libero' }}
          selected={selectedId === libero.id}
          onPress={() => pressPlayer(libero.id)}
          accessibilityLabel={t.lineup.liberoSlotLabel(
            `${libero.number} ${libero.firstName} ${libero.lastName}`,
          )}
          testID="libero-player"
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.lineup.liberoSlotLabel(null)}
          accessibilityHint={selectedId ? t.lineup.slotHintSelected : undefined}
          onPress={() => pressTarget({ kind: 'libero' })}
          style={[styles.empty, selectedId !== null && styles.emptyArmed]}
          testID="libero-empty"
        >
          <Text style={styles.emptyText}>{t.lineup.liberoEmpty}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    minWidth: 104,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.border,
  },
  error: { borderColor: colors.error },
  title: { ...typography.label, color: colors.text },
  empty: {
    minWidth: touchTarget + 12,
    minHeight: touchTarget + 12,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyArmed: { borderColor: colors.highlight, borderStyle: 'solid' },
  emptyText: { ...typography.caption, color: colors.textMuted },
});
