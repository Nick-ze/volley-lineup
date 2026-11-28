import { Text, View } from 'react-native';

import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

export interface ResultScoreboardProps {
  teamA: string;
  teamB: string;
  setsA: number;
  setsB: number;
}

/** Size of the two dots between the numbers (px). */
const DOT = 8;

/**
 * The top of the result screen: the two names with the sets won as large numbers (display
 * typeface, equal-width digits), like the live scoreboard.
 */
export function ResultScoreboard({ teamA, teamB, setsA, setsB }: ResultScoreboardProps) {
  const styles = useStyles();
  const t = useT();
  return (
    <View
      style={styles.board}
      accessible
      accessibilityLabel={t.tournament.result.scoreboardLabel(teamA, setsA, teamB, setsB)}
      testID="result-scoreboard"
    >
      <View style={styles.side}>
        <Text style={styles.name} numberOfLines={2}>
          {teamA}
        </Text>
        <Text style={styles.number} testID="result-sets-a">
          {setsA}
        </Text>
      </View>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
      <View style={styles.side}>
        <Text style={styles.name} numberOfLines={2}>
          {teamB}
        </Text>
        <Text style={styles.number} testID="result-sets-b">
          {setsB}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  board: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: theme.colors.surface,
  },
  side: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xs },
  // Not in capitals: a long club name ("Sportgemeinschaft …") must fit half the panel's width.
  name: { ...typography.label, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  number: { ...typography.score, color: theme.colors.text },
  dots: { gap: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radius.round,
    backgroundColor: theme.colors.textMuted,
  },
}));
