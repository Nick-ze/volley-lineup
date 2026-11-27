import { Text, View } from 'react-native';

import { useListStyles } from '@/components';
import type { SeasonOverview as Overview } from '@/domain/stats';
import { useT } from '@/i18n';
import { borderWidth, makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** One number with its caption, e.g. "Sets 3 : 3". */
function Tile({
  label,
  value,
  a11y,
  testID,
  first = false,
}: {
  label: string;
  value: string;
  a11y: string;
  testID: string;
  /** The first tile has no dividing line at its left. */
  first?: boolean;
}) {
  const styles = useStyles();
  return (
    <View
      style={[styles.tile, !first && styles.divided]}
      accessible
      accessibilityLabel={a11y}
      testID={testID}
    >
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** Season record (matches won–lost), sets and points won : lost. v7.0: optional heading. */
export function SeasonOverview({ overview, heading }: { overview: Overview; heading?: string }) {
  const styles = useStyles();
  const listStyles = useListStyles();
  const t = useT();
  const s = t.stats.season;
  const { won, lost, sets, points, inProgress } = overview;
  return (
    <View style={styles.wrap}>
      <Text style={listStyles.title} accessibilityRole="header">
        {heading ?? s.heading}
      </Text>
      <View style={styles.tiles}>
        <Tile
          label={s.record}
          value={s.recordValue(won, lost)}
          a11y={s.recordLabel(won, lost)}
          testID="season-record"
          first
        />
        <Tile
          label={s.sets}
          value={t.stats.score(sets.us, sets.them)}
          a11y={s.setsLabel(sets.us, sets.them)}
          testID="season-sets"
        />
        <Tile
          label={s.points}
          value={t.stats.score(points.us, points.them)}
          a11y={s.pointsLabel(points.us, points.them)}
          testID="season-points"
        />
      </View>
      {inProgress > 0 ? <Text style={styles.note}>{s.inProgress(inProgress)}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.sm },
  // v11: one band of large numbers on a flat panel, divided by thin lines.
  tiles: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  tile: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  divided: { borderLeftWidth: borderWidth.thin, borderLeftColor: theme.colors.border },
  value: { ...typography.displayM, fontVariant: ['tabular-nums'], color: theme.colors.text },
  label: { ...typography.eyebrow, color: theme.colors.textMuted },
  note: { ...typography.caption, color: theme.colors.textMuted },
}));
