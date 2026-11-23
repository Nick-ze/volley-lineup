import { Text, View } from 'react-native';

import { useListStyles } from '@/components';
import { errorBreakdown, plusMinus, type PlayerSeason } from '@/domain/performance';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

interface TileData {
  id: string;
  label: string;
  value: string;
  a11y: string;
}

type CountKey =
  | 'setsStarted'
  | 'setsPlayed'
  | 'subIn'
  | 'subOut'
  | 'serveTurns'
  | 'serves'
  | 'servePoints'
  | 'kills'
  | 'aces'
  | 'blocks'
  | 'errors';

function Tile({ id, label, value, a11y }: TileData) {
  const styles = useStyles();
  return (
    <View style={styles.tile} accessible accessibilityLabel={a11y} testID={`season-${id}`}>
      <Text style={styles.value} testID={`season-${id}-value`}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** The season totals as rows of three compact tiles (fits 375 px), plus the errors by type. */
export function SeasonStats({ season }: { season: PlayerSeason }) {
  const styles = useStyles();
  const listStyles = useListStyles();
  const t = useT();
  const s = t.playerDetail.season;
  const p = season.total;
  const pm = t.playerDetail.signed(plusMinus(p));
  const count = (id: CountKey): TileData => ({
    id,
    label: s[id],
    value: String(p[id]),
    a11y: s.tileLabel(s[id], String(p[id])),
  });
  const rows: TileData[][] = [
    [
      {
        id: 'rallies',
        label: s.rallies,
        value: s.ralliesValue(p.rallies, season.rallies),
        a11y: s.ralliesLabel(p.rallies, season.rallies),
      },
      { id: 'plusMinus', label: s.plusMinus, value: pm, a11y: s.plusMinusLabel(p.won, p.lost, pm) },
      count('setsPlayed'),
    ],
    [count('setsStarted'), count('subIn'), count('subOut')],
    [count('serveTurns'), count('serves'), count('servePoints')],
    [count('kills'), count('aces'), count('blocks')],
  ];
  const breakdown = errorBreakdown(p);

  return (
    <View style={styles.wrap} testID="season-stats">
      <Text style={listStyles.title} accessibilityRole="header">
        {s.heading}
      </Text>
      {rows.map((row) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((tile) => (
            <Tile key={tile.id} {...tile} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Tile {...count('errors')} />
        <View style={styles.breakdown} testID="season-error-breakdown">
          <Text style={styles.breakdownHeading}>{s.breakdownHeading}</Text>
          {breakdown.length === 0 ? (
            <Text style={styles.breakdownText}>{t.stats.none}</Text>
          ) : (
            breakdown.map((b) => (
              <Text key={b.category} style={styles.breakdownText}>
                {s.breakdownItem(b.count, t.tags.errorTypeNames[b.category])}
              </Text>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  value: { ...typography.subheading, color: theme.colors.text },
  label: { ...typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  // Two tiles wide, next to the Errors tile.
  breakdown: { flex: 2, justifyContent: 'center', padding: spacing.sm },
  breakdownHeading: { ...typography.caption, color: theme.colors.textMuted },
  breakdownText: { ...typography.label, color: theme.colors.text },
}));
