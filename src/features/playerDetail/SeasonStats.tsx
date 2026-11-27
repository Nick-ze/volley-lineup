import { Text, View } from 'react-native';

import { useListStyles } from '@/components';
import { errorBreakdown, plusMinus, type PlayerSeason } from '@/domain/performance';
import { useT } from '@/i18n';
import { borderWidth, makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

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

function Tile({ id, label, value, a11y, large = false }: TileData & { large?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.tile} accessible accessibilityLabel={a11y} testID={`season-${id}`}>
      <Text style={large ? styles.valueLarge : styles.value} testID={`season-${id}-value`}>
        {value}
      </Text>
      <Text style={large ? styles.labelLarge : styles.label}>{label}</Text>
    </View>
  );
}

/**
 * The season totals as rows of three (fits 375 px), plus the errors by type. v11: one stat sheet;
 * the first row (rallies, +/−, sets played) is large.
 */
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
      <View style={styles.sheet}>
        {rows.map((row, index) => (
          <View key={row[0].id} style={[styles.row, index > 0 && styles.divided]}>
            {row.map((tile) => (
              <Tile key={tile.id} {...tile} large={index === 0} />
            ))}
          </View>
        ))}
        <View style={[styles.row, styles.divided]}>
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
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.sm },
  // v11: one stat sheet on a flat panel — the first row large, thin lines between the rows.
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  divided: { borderTopWidth: borderWidth.thin, borderTopColor: theme.colors.border },
  tile: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  value: { ...typography.heading, fontVariant: ['tabular-nums'], color: theme.colors.text },
  // "11 of 11" must stay on one line in a third of 375 px; the wide dyslexia font keeps the
  // size it had before v11.
  valueLarge: {
    ...(theme.dyslexiaFont ? typography.subheading : typography.displayM),
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  label: { ...typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  labelLarge: { ...typography.eyebrow, color: theme.colors.textMuted, textAlign: 'center' },
  // Two tiles wide, next to the Errors tile.
  breakdown: { flex: 2, justifyContent: 'center', padding: spacing.sm },
  breakdownHeading: { ...typography.caption, color: theme.colors.textMuted },
  breakdownText: { ...typography.label, color: theme.colors.text },
}));
