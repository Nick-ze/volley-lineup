import { Text, View } from 'react-native';

import { Button } from '@/components';
import { durationParts } from '@/domain/duration';
import type { MatchState } from '@/domain/matchState';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

export interface MatchSummaryProps {
  state: MatchState;
  opponent: string;
  onBack: () => void;
  /** Undo the last point of the match (re-opens the deciding set). */
  onUndo: () => void;
  /** The match-winning rally's tag ("kill #7 Smith"), named in the undo label; null if none. */
  tagDetail?: string | null;
}

/** Shown once a side has won 3 sets: final result, every set's score, duration, back / undo. */
export function MatchSummary({
  state,
  opponent,
  onBack,
  onUndo,
  tagDetail = null,
}: MatchSummaryProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.live.summary;
  const { us, them } = state.setsWon;
  // Under a minute (or without stamps) shows nothing, as on the printed sheet.
  const parts =
    state.durationMs !== null && state.durationMs >= 60_000
      ? durationParts(state.durationMs)
      : null;
  const duration = parts ? s.duration(parts.hours, parts.minutes) : null;
  const undoLabel = t.live.undoLastPointLabel(state.winner === 'us');

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
        accessibilityLabel={tagDetail ? t.tags.withDetail(undoLabel, tagDetail) : undoLabel}
        variant="secondary"
        onPress={onUndo}
        testID="undo"
      />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  box: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.highlight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.label, color: theme.colors.textMuted, textAlign: 'center' },
  result: { ...typography.title, color: theme.colors.highlightText, textAlign: 'center' },
  sets: { gap: spacing.xs },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  setName: { ...typography.body, color: theme.colors.textMuted },
  setScore: { ...typography.subheading, color: theme.colors.text },
  setWon: { color: theme.colors.highlightText },
  duration: { ...typography.body, color: theme.colors.textMuted, textAlign: 'center' },
}));
