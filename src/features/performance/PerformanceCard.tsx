import { Pressable, Text, View } from 'react-native';

import { netPoints, rating, type PlayerPerformance } from '@/domain/performance';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { performanceRef } from './format';
import { PlayerAvatar } from './PlayerAvatar';
import { RatingBadge } from './RatingBadge';

export interface PerformanceCardProps {
  player: Player;
  performance: PlayerPerformance;
  onPress: () => void;
}

/** One player in the overview: rallies, won–lost (±), K / A / B vs E (net) and the rating. */
export function PerformanceCard({ player, performance: p, onPress }: PerformanceCardProps) {
  const styles = useStyles();
  const t = useT();
  const pt = t.performance;
  const ref = performanceRef(t, player);
  const r = rating(p);
  const net = netPoints(p);
  const label = pt.rowLabel(
    ref,
    [
      pt.rallies(p.rallies),
      pt.recordLabel(p.won, p.lost),
      pt.actionsLabel(p.kills, p.aces, p.blocks, p.errors, net),
      pt.ratingLabel(pt.rating[r ?? 'none']),
    ].join(', '),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`perf-row-${player.id}`}
    >
      <PlayerAvatar player={player} />
      <View style={styles.main}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {ref}
          </Text>
          <RatingBadge rating={r} testID={`perf-rating-${player.id}`} />
        </View>
        <Text style={styles.line} testID={`perf-record-${player.id}`}>
          {`${pt.rallies(p.rallies)} · ${pt.record(p.won, p.lost)}`}
        </Text>
        <Text style={styles.line} testID={`perf-actions-${player.id}`}>
          {pt.actions(p.kills, p.aces, p.blocks, p.errors, net)}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
  },
  pressed: { opacity: 0.8 },
  main: { flex: 1, minWidth: 0, gap: spacing.xxs },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { ...typography.body, fontWeight: '700', color: theme.colors.text, flexShrink: 1 },
  line: { ...typography.label, color: theme.colors.textMuted },
}));
