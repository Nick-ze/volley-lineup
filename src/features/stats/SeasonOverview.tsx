import { Text, View } from 'react-native';

import { useListStyles } from '@/components';
import type { SeasonOverview as Overview } from '@/domain/stats';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** One number with its caption, e.g. "Sets 3 : 3". */
function Tile({
  label,
  value,
  a11y,
  testID,
}: {
  label: string;
  value: string;
  a11y: string;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.tile} accessible accessibilityLabel={a11y} testID={testID}>
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
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  value: { ...typography.subheading, color: theme.colors.text },
  label: { ...typography.caption, color: theme.colors.textMuted },
  note: { ...typography.caption, color: theme.colors.textMuted },
}));
