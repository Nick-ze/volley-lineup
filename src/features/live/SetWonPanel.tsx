import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import type { Score } from '@/domain/liveSet';
import type { SetNumber, Side } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

export interface SetWonPanelProps {
  setNumber: SetNumber;
  winner: Side;
  score: Score;
  opponent: string;
  /** The next set, or null after set 5. */
  next: SetNumber | null;
  /** True when the next set already has events ("Go to set N" instead of "Start set N"). */
  nextPlayed: boolean;
  onNext: (set: SetNumber) => void;
  /** Undo the winning point (re-opens the set); null when later sets were played. */
  onUndo: (() => void) | null;
  /** The winning rally's tag ("kill #7 Smith"), named in the undo label; null when untagged. */
  tagDetail?: string | null;
}

/** Replaces the rally buttons once a set is won: who won, the score, next set, undo. */
export function SetWonPanel({
  setNumber,
  winner,
  score,
  opponent,
  next,
  nextPlayed,
  onNext,
  onUndo,
  tagDetail = null,
}: SetWonPanelProps) {
  const t = useT();
  const us = winner === 'us';
  return (
    <View style={styles.box} testID="set-won-panel">
      <Text style={styles.title} accessibilityRole="header" testID="set-won-title">
        {t.live.setWonBy(us, opponent)}
      </Text>
      <Text
        style={styles.score}
        accessibilityLabel={t.live.scoreLabel(setNumber, score.us, score.them, opponent)}
      >
        {t.live.setFinalScore(score.us, score.them)}
      </Text>
      {next ? (
        <Button
          label={nextPlayed ? t.live.goToSet(next) : t.live.startSet(next)}
          accessibilityLabel={nextPlayed ? t.live.goToSet(next) : t.live.startSetLabel(next)}
          onPress={() => onNext(next)}
          testID="next-set"
        />
      ) : null}
      {onUndo ? (
        <Button
          label={t.live.undoLastPoint}
          accessibilityLabel={
            tagDetail ? t.tags.withDetail(t.live.undoPoint(us), tagDetail) : t.live.undoPoint(us)
          }
          variant="secondary"
          onPress={onUndo}
          testID="undo"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.highlight,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { ...typography.subheading, color: colors.highlight, textAlign: 'center' },
  score: { ...typography.heading, color: colors.text, textAlign: 'center' },
});
