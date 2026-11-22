import { Text, View } from 'react-native';

import type { Score } from '@/domain/liveSet';
import type { Side } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { SCORE_FONT_SIZE, SERVE_DOT_SIZE } from './layout';

export interface ScoreboardProps {
  setNumber: number;
  opponent: string;
  score: Score;
  /** Sets won so far in the match. */
  setsWon: Score;
  servingSide: Side;
  /** "We serve · #8" / "Rivals serves". */
  serveText: string;
  rotation: number;
}

/** Big "us : them" score with the set number and sets won; the serving side gets a yellow dot and name. */
export function Scoreboard({
  setNumber,
  opponent,
  score,
  setsWon,
  servingSide,
  serveText,
  rotation,
}: ScoreboardProps) {
  const styles = useStyles();
  const t = useT();
  const side = (who: Side, name: string, value: number) => {
    const serving = servingSide === who;
    return (
      <View style={styles.side}>
        <View style={styles.nameRow}>
          {serving ? <View style={styles.dot} testID={`serve-dot-${who}`} /> : null}
          <Text style={[styles.name, serving && styles.serving]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text style={styles.score} testID={`score-${who}`}>
          {value}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={styles.box}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${t.live.scoreLabel(setNumber, score.us, score.them, opponent)}. ${t.live.setsScoreLabel(setsWon.us, setsWon.them)}. ${serveText}. ${t.live.rotation(rotation)}`}
      testID="scoreboard"
    >
      <View style={styles.topRow}>
        <Text style={styles.set}>{t.live.setLabel(setNumber)}</Text>
        <Text style={styles.sets} testID="set-score">
          {t.live.setsScore(setsWon.us, setsWon.them)}
        </Text>
      </View>
      <View style={styles.row}>
        {side('us', t.live.us, score.us)}
        <Text style={styles.colon}>:</Text>
        {side('them', t.live.them(opponent), score.them)}
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.serveText} testID="serve-text">
          {serveText}
        </Text>
        <Text style={styles.muted} testID="rotation-text">
          {t.live.rotation(rotation)}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  box: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  topRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  set: { ...typography.label, color: theme.colors.textMuted },
  sets: { ...typography.label, color: theme.colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  side: { flex: 1, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  dot: {
    width: SERVE_DOT_SIZE,
    height: SERVE_DOT_SIZE,
    borderRadius: SERVE_DOT_SIZE / 2,
    backgroundColor: theme.colors.highlight,
  },
  name: { ...typography.subheading, color: theme.colors.text, flexShrink: 1 },
  serving: { color: theme.colors.highlightText },
  score: { fontSize: SCORE_FONT_SIZE, fontWeight: '800', color: theme.colors.text },
  colon: { fontSize: SCORE_FONT_SIZE, fontWeight: '800', color: theme.colors.textMuted },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  serveText: { ...typography.label, color: theme.colors.highlightText },
  muted: { ...typography.label, color: theme.colors.textMuted },
}));
