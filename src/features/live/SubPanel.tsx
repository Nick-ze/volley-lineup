import { Text, View } from 'react-native';

import { Button, PlayerChip } from '@/components';
import { MAX_SUBS_PER_SET, type LiveWarningCode } from '@/domain/liveSet';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { playerDescription } from './format';
import { BENCH_CHIP_SIZE, BENCH_ITEM_MAX_WIDTH } from './layout';

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
  /** Warnings bringing this bench player in would trigger (only once a player is going out). */
  warningsFor: (playerId: string) => LiveWarningCode[];
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
  warningsFor,
}: SubPanelProps) {
  const styles = useStyles();
  const t = useT();
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
        {bench.map((p) => {
          const code = outRef ? warningsFor(p.id)[0] : undefined;
          const warning = code ? t.live.previewWarning[code] : null;
          return (
            <View key={p.id} style={styles.benchItem}>
              <PlayerChip
                player={p}
                size={BENCH_CHIP_SIZE}
                showPhoto
                onPress={outRef ? () => onPickIn(p.id) : undefined}
                accessibilityLabel={playerDescription(t, p)}
                accessibilityHint={outRef ? t.live.benchPlayerHint(outRef, warning) : undefined}
                testID={`live-bench-${p.number}`}
              />
              {warning ? (
                <Text
                  style={styles.chipWarning}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                  testID={`live-bench-warning-${p.number}`}
                >
                  {warning}
                </Text>
              ) : null}
            </View>
          );
        })}
        {bench.length === 0 ? <Text style={styles.muted}>{t.live.benchEmpty}</Text> : null}
      </View>
      <Text style={styles.muted}>{t.live.libero(liberoRef)}</Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  box: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  count: { ...typography.subheading, color: theme.colors.text },
  over: { color: theme.colors.error },
  prompt: { ...typography.body, color: theme.colors.highlightText },
  title: { ...typography.label, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  muted: { ...typography.body, color: theme.colors.textMuted },
  benchItem: { alignItems: 'center', maxWidth: BENCH_ITEM_MAX_WIDTH, gap: spacing.xxs },
  chipWarning: { ...typography.caption, color: theme.colors.error, textAlign: 'center' },
}));
