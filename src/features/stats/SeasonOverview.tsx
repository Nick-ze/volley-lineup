import { StyleSheet, Text, View } from 'react-native';

import type { SeasonOverview as Overview } from '@/domain/stats';
import { listStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

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
  return (
    <View style={styles.tile} accessible accessibilityLabel={a11y} testID={testID}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** Season record (matches won–lost), sets and points won : lost. */
export function SeasonOverview({ overview }: { overview: Overview }) {
  const t = useT();
  const s = t.stats.season;
  const { won, lost, sets, points, inProgress } = overview;
  return (
    <View style={styles.wrap}>
      <Text style={listStyles.title} accessibilityRole="header">
        {s.heading}
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

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { ...typography.subheading, color: colors.text },
  label: { ...typography.caption, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted },
});
