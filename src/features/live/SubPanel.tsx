import { StyleSheet, Text, View } from 'react-native';

import { Button, PlayerChip } from '@/components';
import { MAX_SUBS_PER_SET } from '@/domain/liveSet';
import type { Player } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, radius, spacing, typography } from '@/theme';

import { playerDescription } from './format';
import { BENCH_CHIP_SIZE } from './layout';

export interface SubPanelProps {
  subsUsed: number;
  /** Substitution flow started (waiting for a court player, then a bench player). */
  active: boolean;
  /** "#5 Wing" once the player going out has been picked. */
  outRef: string | null;
  bench: Player[];
  liberoRef: string | null;
  onStart: () => void;
  onCancel: () => void;
  onPickIn: (playerId: string) => void;
}

/** "Subs used n/6", the substitution button and prompts, and the bench to pick from. */
export function SubPanel({
  subsUsed,
  active,
  outRef,
  bench,
  liberoRef,
  onStart,
  onCancel,
  onPickIn,
}: SubPanelProps) {
  const over = subsUsed > MAX_SUBS_PER_SET;
  return (
    <View style={styles.box} testID="sub-panel">
      <View style={styles.header}>
        <Text style={[styles.count, over && styles.over]} testID="subs-used">
          {t.live.subsUsed(subsUsed, MAX_SUBS_PER_SET)}
        </Text>
        {active ? (
          <Button
            label={t.live.cancelSub}
            accessibilityLabel={t.live.cancelSubLabel}
            variant="secondary"
            compact
            onPress={onCancel}
            testID="sub-cancel"
          />
        ) : (
          <Button
            label={t.live.substitution}
            accessibilityLabel={t.live.substitutionLabel}
            variant="secondary"
            compact
            onPress={onStart}
            testID="sub-start"
          />
        )}
      </View>
      {active ? (
        <Text style={styles.prompt} accessibilityLiveRegion="polite" testID="sub-prompt">
          {outRef ? t.live.pickIn(outRef) : t.live.pickOut}
        </Text>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {t.live.benchTitle}
      </Text>
      <View style={styles.grid}>
        {bench.map((p) => (
          <PlayerChip
            key={p.id}
            player={p}
            size={BENCH_CHIP_SIZE}
            onPress={outRef ? () => onPickIn(p.id) : undefined}
            accessibilityLabel={playerDescription(p)}
            accessibilityHint={outRef ? t.live.benchPlayerHint(outRef) : undefined}
            testID={`live-bench-${p.number}`}
          />
        ))}
        {bench.length === 0 ? <Text style={styles.muted}>{t.live.benchEmpty}</Text> : null}
      </View>
      <Text style={styles.muted}>{t.live.libero(liberoRef)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  count: { ...typography.subheading, color: colors.text },
  over: { color: colors.error },
  prompt: { ...typography.body, color: colors.highlight },
  title: { ...typography.label, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  muted: { ...typography.body, color: colors.textMuted },
});
