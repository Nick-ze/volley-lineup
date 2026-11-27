import { Pressable, Text, View } from 'react-native';

import { fullName } from '@/domain/playerNames';
import { useT } from '@/i18n';
import { useIsCaptain } from '@/store';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { COMPACT_CHIP_SIZE, EMPTY_SLOT_SIZE, LIBERO_BOX_MIN_WIDTH } from './constants';
import { DraggablePlayer } from './drag/DraggablePlayer';
import { useDropZone } from './drag/useDropZone';
import type { LineupDraft } from './useLineupDraft';

/** The libero spot next to the court: a drop zone holding at most one player. */
export function LiberoSlot({
  editor,
  compact = false,
}: {
  editor: LineupDraft;
  compact?: boolean;
}) {
  const styles = useStyles();
  const t = useT();
  const { set, selectedId, playerById, pressPlayer, pressTarget, validation } = editor;
  const { onRef: zoneRef, style: zoneStyle } = useDropZone({ kind: 'libero' });
  const libero = playerById(set.liberoId);
  const captain = useIsCaptain(libero);
  const hasError = validation.errors.some((e) => e.code === 'LIBERO_ON_COURT');

  return (
    <View
      ref={zoneRef}
      collapsable={false}
      style={[styles.box, compact && styles.compactBox, hasError && styles.error, zoneStyle]}
      testID="libero-slot"
    >
      <Text style={styles.title}>{t.lineup.libero}</Text>
      {libero ? (
        <DraggablePlayer
          player={libero}
          from={{ kind: 'libero' }}
          selected={selectedId === libero.id}
          onPress={() => pressPlayer(libero.id)}
          size={compact ? COMPACT_CHIP_SIZE : undefined}
          accessibilityLabel={t.lineup.liberoSlotLabel(
            t.player.withCaptain(`${libero.number} ${fullName(libero)}`, captain),
          )}
          testID="libero-player"
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.lineup.liberoSlotLabel(null)}
          accessibilityHint={selectedId ? t.lineup.slotHintSelected : undefined}
          disabled={editor.locked}
          accessibilityState={{ disabled: editor.locked }}
          aria-disabled={editor.locked}
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

const useStyles = makeStyles((theme) => ({
  box: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    minWidth: LIBERO_BOX_MIN_WIDTH,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: theme.colors.transparent,
  },
  // Phone layout: title beside the chip, so the row stays low.
  compactBox: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  error: { borderColor: theme.colors.error },
  title: { ...typography.label, color: theme.colors.text },
  empty: {
    minWidth: EMPTY_SLOT_SIZE,
    minHeight: EMPTY_SLOT_SIZE,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyArmed: { borderColor: theme.colors.highlightText, borderStyle: 'solid' },
  emptyText: { ...typography.caption, color: theme.colors.textMuted },
}));
