import { Text, View } from 'react-native';

import { useT } from '@/i18n';
import { SCORE_FONT_SIZE, SCORE_LINE_HEIGHT } from '@/features/live/layout';
import { makeStyles, radius, spacing, typography } from '@/theme';

export interface LiveBoardProps {
  setNumber: number;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  setsA: number;
  setsB: number;
}

/**
 * v12.2: the scoreboard of a tournament match scored live — the set and the sets won, the two
 * names and the running score as the biggest thing on the screen (equal-width digits). No serve
 * and no rotation: a hosted tournament is a neutral scoreboard.
 */
export function LiveBoard({
  setNumber,
  teamA,
  teamB,
  scoreA,
  scoreB,
  setsA,
  setsB,
}: LiveBoardProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.live;
  const side = (name: string, value: number, testID: string) => (
    <View style={styles.side}>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.score} testID={testID}>
        {value}
      </Text>
    </View>
  );
  return (
    <View
      style={styles.box}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${s.scoreLabel(setNumber, teamA, scoreA, teamB, scoreB)}. ${s.sets(setsA, setsB)}`}
      testID="live-board"
    >
      <View style={styles.topRow}>
        <Text style={styles.set} testID="live-set">
          {s.set(setNumber)}
        </Text>
        <Text style={styles.sets} testID="live-sets">
          {s.sets(setsA, setsB)}
        </Text>
      </View>
      <View style={styles.row}>
        {side(teamA, scoreA, 'live-score-a')}
        <Text style={styles.colon}>{s.colon}</Text>
        {side(teamB, scoreB, 'live-score-b')}
      </View>
    </View>
  );
}

const SCORE = {
  ...typography.score,
  fontSize: SCORE_FONT_SIZE,
  lineHeight: SCORE_LINE_HEIGHT,
} as const;

const useStyles = makeStyles((theme) => ({
  box: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.xs,
  },
  topRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  set: { ...typography.eyebrow, color: theme.colors.textMuted },
  sets: { ...typography.eyebrow, color: theme.colors.text },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  side: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xxs },
  name: { ...typography.label, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  score: { ...SCORE, color: theme.colors.text },
  colon: { ...SCORE, color: theme.colors.textMuted },
}));
