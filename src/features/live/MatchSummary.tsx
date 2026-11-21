import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { durationParts } from '@/domain/matchFlow';
import type { MatchState } from '@/domain/matchState';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

export interface MatchSummaryProps {
  state: MatchState;
  opponent: string;
  onBack: () => void;
  /** Undo the last point of the match (re-opens the deciding set). */
  onUndo: () => void;
}

/** Shown once a side has won 3 sets: final result, every set's score, duration, back / undo. */
export function MatchSummary({ state, opponent, onBack, onUndo }: MatchSummaryProps) {
  const t = useT();
  const s = t.live.summary;
  const { us, them } = state.setsWon;
  const parts = state.durationMs === null ? null : durationParts(state.durationMs);
  const duration = parts ? s.duration(parts.hours, parts.minutes) : null;

  return (
    <View style={styles.box} testID="match-summary">
      <Text style={styles.title} accessibilityRole="header">
        {s.title}
      </Text>
      <Text style={styles.result} testID="summary-result">
        {state.winner === 'us' ? s.won(us, them) : s.lost(us, them)}
      </Text>
      <View style={styles.sets}>
        {state.sets.map((set) => (
          <View
            key={set.setNumber}
            style={styles.setRow}
            accessible
            accessibilityLabel={s.setScoreLabel(
              set.setNumber,
              set.score.us,
              set.score.them,
              opponent,
            )}
            testID={`summary-set-${set.setNumber}`}
          >
            <Text style={styles.setName}>{s.setLine(set.setNumber)}</Text>
            <Text style={[styles.setScore, set.winner === 'us' && styles.setWon]}>
              {t.live.setFinalScore(set.score.us, set.score.them)}
            </Text>
          </View>
        ))}
      </View>
      {duration ? (
        <Text
          style={styles.duration}
          accessibilityLabel={s.durationLabel(duration)}
          testID="summary-duration"
        >
          {duration}
        </Text>
      ) : null}
      <Button
        label={s.back}
        accessibilityLabel={s.backLabel}
        onPress={onBack}
        testID="summary-back"
      />
      <Button
        label={t.live.undoLastPoint}
        accessibilityLabel={t.live.undoPoint(state.winner === 'us')}
        variant="secondary"
        onPress={onUndo}
        testID="undo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.highlight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.label, color: colors.textMuted, textAlign: 'center' },
  result: { ...typography.title, color: colors.highlight, textAlign: 'center' },
  sets: { gap: spacing.xs },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setName: { ...typography.body, color: colors.textMuted },
  setScore: { ...typography.subheading, color: colors.text },
  setWon: { color: colors.highlight },
  duration: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
