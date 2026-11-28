import { Text, View } from 'react-native';

import type { HostedSettings, Standing } from '@/domain/hostedTournament';
import { useT } from '@/i18n';
import { borderWidth, makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

import { ballDifferenceText, pointsUnit, recordText } from './tournamentText';

/**
 * A team's rank and numbers as one band of large numbers (like a season's record): rank, table
 * points and matches played above; record, sets and ball difference below.
 */
export function TeamNumbers({
  standing,
  settings,
}: {
  standing: Standing;
  settings: HostedSettings;
}) {
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.team;
  const record = recordText(t, standing, settings);
  const sets = s.setsValue(standing.setsFor, standing.setsAgainst);
  const balls = ballDifferenceText(t, standing);
  const unit = pointsUnit(t, settings);
  const rows: [string, string, string][][] = [
    [
      [s.rank, `${standing.rank}`, 'team-rank'],
      [s.points, `${standing.points}`, 'team-points'],
      [s.played, `${standing.played}`, 'team-played'],
    ],
    [
      [s.record, record, 'team-record'],
      [s.sets, sets, 'team-sets'],
      [s.balls, balls, 'team-balls'],
    ],
  ];
  return (
    <View
      style={styles.band}
      accessible
      accessibilityLabel={s.summaryLabel(
        standing.rank,
        standing.played,
        record,
        sets,
        balls,
        standing.points,
        unit,
      )}
      testID="team-numbers"
    >
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, rowIndex > 0 && styles.rowDivided]}>
          {row.map(([label, value, testID], index) => (
            <View key={testID} style={[styles.tile, index > 0 && styles.divided]}>
              <Text style={styles.value} numberOfLines={1} testID={testID}>
                {value}
              </Text>
              <Text style={styles.label} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  band: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
  },
  row: { flexDirection: 'row', paddingVertical: spacing.sm },
  rowDivided: { borderTopWidth: borderWidth.thin, borderTopColor: theme.colors.border },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  divided: { borderLeftWidth: borderWidth.thin, borderLeftColor: theme.colors.border },
  value: { ...typography.displayM, fontVariant: ['tabular-nums'], color: theme.colors.text },
  label: { ...typography.eyebrow, color: theme.colors.textMuted },
}));
