import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { locatePlayer } from '@/domain/lineupEditing';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { BENCH_MIN_HEIGHT, COMPACT_CHIP_SIZE } from './constants';
import { DraggablePlayer } from './drag/DraggablePlayer';
import { useDropZone } from './drag/useDropZone';
import type { LineupDraft } from './useLineupDraft';

/**
 * Active players not on court and not libero. Also a drop zone: dropping a court / libero
 * player here takes them off. `scrollable` gives the bench its own scroll area (wide layout).
 */
export function Bench({
  editor,
  scrollable,
  compact = false,
}: {
  editor: LineupDraft;
  scrollable: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const { bench, set, selectedId, pressPlayer, pressTarget } = editor;
  const { onRef: zoneRef, style: zoneStyle } = useDropZone({ kind: 'bench' });
  const selectedOffBench = selectedId !== null && locatePlayer(set, selectedId).kind !== 'bench';

  const grid = (
    <View style={[styles.grid, compact && styles.compactGrid]}>
      {bench.map((p) => (
        <DraggablePlayer
          key={p.id}
          player={p}
          from={{ kind: 'bench' }}
          selected={selectedId === p.id}
          onPress={() => pressPlayer(p.id)}
          size={compact ? COMPACT_CHIP_SIZE : undefined}
          showPhoto
          testID={`bench-player-${p.number}`}
        />
      ))}
      {bench.length === 0 ? <Text style={styles.empty}>{t.lineup.benchEmpty}</Text> : null}
    </View>
  );

  return (
    <View
      ref={zoneRef}
      collapsable={false}
      style={[styles.box, compact && styles.compactBox, scrollable && styles.fill, zoneStyle]}
      testID="bench"
    >
      <Text style={compact ? styles.compactTitle : styles.title} accessibilityRole="header">
        {t.lineup.benchTitle(bench.length)}
      </Text>
      {selectedOffBench ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.lineup.benchDropLabel}
          disabled={editor.locked}
          accessibilityState={{ disabled: editor.locked }}
          aria-disabled={editor.locked}
          onPress={() => pressTarget({ kind: 'bench' })}
          style={styles.dropTarget}
          testID="bench-drop"
        >
          <Text style={styles.dropText}>{t.lineup.benchDropHint}</Text>
        </Pressable>
      ) : null}
      {scrollable ? <ScrollView style={styles.scroll}>{grid}</ScrollView> : grid}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.border,
  },
  fill: { flex: 1, minHeight: BENCH_MIN_HEIGHT },
  compactBox: { padding: spacing.sm, gap: spacing.xs },
  compactGrid: { gap: spacing.sm, paddingVertical: 0 },
  scroll: { flex: 1 },
  title: { ...typography.subheading, color: colors.text },
  compactTitle: { ...typography.label, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingVertical: spacing.xs },
  empty: { ...typography.body, color: colors.textMuted },
  dropTarget: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.highlight,
  },
  dropText: { ...typography.label, color: colors.highlight },
});
