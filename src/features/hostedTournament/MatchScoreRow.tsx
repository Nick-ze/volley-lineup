import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { PRESS_SCALE } from '@/components';
import type { PlanMatch } from '@/domain/hostedTournament';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

/** Width of one set's column and of the "sets won" column (wider with the dyslexia font). */
const SET_COLUMN = 26;
const SET_COLUMN_WIDE_FONT = 34;
const CHEVRON_SIZE = 18;

export interface MatchScoreRowProps {
  match: PlanMatch;
  onPress: () => void;
  testID?: string;
}

/**
 * A match as a scoreboard line: the two names one above the other; at the right one narrow
 * column per set with the two scores, and a last column with the sets won. The winner's name and
 * sets are bold in full colour, the loser's grey; a draw (and a match still running) shows both
 * in full colour. A match without a result shows "–" and a chevron.
 */
export function MatchScoreRow({ match, onPress, testID }: MatchScoreRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const t = useT();
  const s = t.tournament.matches;
  const { teamA, teamB, sets, outcome } = match;
  const open = outcome.state === 'open';
  const { winner } = outcome;
  // Who is drawn as the loser (grey): only the beaten side of a finished match.
  const lostA = winner === 'b';
  const lostB = winner === 'a';
  const label = open
    ? s.label.open(teamA.name, teamB.name)
    : s.label.result(
        teamA.name,
        teamB.name,
        outcome.setsA,
        outcome.setsB,
        sets.map((x) => `${x.a}:${x.b}`).join(', '),
      );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.names}>
        <Text
          style={[styles.name, winner === 'a' && styles.won, lostA && styles.lost]}
          numberOfLines={1}
        >
          {teamA.name}
        </Text>
        <Text
          style={[styles.name, winner === 'b' && styles.won, lostB && styles.lost]}
          numberOfLines={1}
        >
          {teamB.name}
        </Text>
      </View>
      {open ? (
        <>
          <Text style={styles.open}>{s.open}</Text>
          <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={colors.textMuted} />
        </>
      ) : (
        <>
          {sets.map((set, index) => (
            <View key={index} style={styles.column}>
              <Text style={[styles.score, set.a > set.b && styles.scoreWon]}>{set.a}</Text>
              <Text style={[styles.score, set.b > set.a && styles.scoreWon]}>{set.b}</Text>
            </View>
          ))}
          <View style={[styles.column, styles.total]}>
            <Text style={[styles.sets, lostA && styles.lost]}>{outcome.setsA}</Text>
            <Text style={[styles.sets, lostB && styles.lost]}>{outcome.setsB}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => {
  const column = theme.dyslexiaFont ? SET_COLUMN_WIDE_FONT : SET_COLUMN;
  return {
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: touchTarget + spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: theme.colors.surface,
    },
    pressed: { opacity: 0.8, transform: [{ scale: PRESS_SCALE }] },
    names: { flex: 1, minWidth: 0, gap: spacing.xs },
    name: { ...typography.body, fontWeight: '600', color: theme.colors.text },
    won: { fontWeight: '800' },
    lost: { fontWeight: '500', color: theme.colors.textMuted },
    column: { width: column, gap: spacing.xs, alignItems: 'flex-end' },
    score: {
      ...typography.label,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
      color: theme.colors.textMuted,
    },
    scoreWon: { fontWeight: '700', color: theme.colors.text },
    total: { marginLeft: spacing.xs },
    sets: {
      ...typography.body,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      color: theme.colors.text,
    },
    open: { ...typography.body, fontWeight: '700', color: theme.colors.textMuted },
  };
});
