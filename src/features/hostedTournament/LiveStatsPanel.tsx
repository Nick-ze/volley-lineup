import { Text, View } from 'react-native';

import { useFormStyles, useListStyles } from '@/components';
import { hasTags, playerRef, type KindCounts, type SideStats } from '@/domain/hostedTournament';
import { HOSTED_POINT_KINDS, type HostedPlayer, type HostedPlayerLabel } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

/** One side's numbers with what is needed to name its players. */
export interface StatsSide {
  name: string;
  stats: SideStats;
  players: readonly HostedPlayer[];
  label: HostedPlayerLabel;
}

/** "4 blocks · 2 aces" — only what happened, in the kinds' order. */
export function countsLine(t: Strings, counts: KindCounts): string {
  const s = t.tournament.live.stats;
  return HOSTED_POINT_KINDS.filter((kind) => counts[kind] > 0)
    .map((kind) => s[kind](counts[kind]))
    .join(t.tournament.metaSeparator);
}

/**
 * v12.2: what the point details add up to — per team a line ("TV Nord: 4 blocks · 2 aces"), and
 * under it a line per player that was named ("Kelly: 1 ace"). A team without players has only
 * its own line. Sides without any detail are left out; with none at all, `empty` is shown.
 */
export function LiveStatsPanel({
  sides,
  empty,
  title,
}: {
  sides: readonly StatsSide[];
  /** Shown when nobody has a detail (left out: the panel is not drawn then). */
  empty?: string;
  title?: string;
}) {
  const formStyles = useFormStyles();
  const listStyles = useListStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.live.stats;
  const shown = sides.filter((side) => hasTags(side.stats));
  if (shown.length === 0 && empty === undefined) return null;
  return (
    <View style={styles.wrap} testID="live-stats">
      <Text style={listStyles.heading} accessibilityRole="header">
        {title ?? s.title}
      </Text>
      {shown.length === 0 ? <Text style={formStyles.hint}>{empty}</Text> : null}
      {shown.map((side, index) => {
        const line = countsLine(t, side.stats.counts);
        return (
          <View
            key={`${side.name}-${index}`}
            style={styles.side}
            accessible
            accessibilityLabel={s.teamLabel(side.name, line)}
            testID={`live-stats-side-${index}`}
          >
            <Text style={styles.team} numberOfLines={1}>
              {side.name}
            </Text>
            <Text style={styles.line} testID={`live-stats-line-${index}`}>
              {line}
            </Text>
            {side.players
              .filter((player) => side.stats.players.has(player.id))
              .map((player) => (
                <Text
                  key={player.id}
                  style={styles.player}
                  testID={`live-stats-player-${player.id}`}
                >
                  {s.playerLine(
                    playerRef(player, side.label, t.tournament.players.numberText).short,
                    countsLine(t, side.stats.players.get(player.id) as KindCounts),
                  )}
                </Text>
              ))}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.sm },
  side: {
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: theme.colors.surface,
  },
  team: { ...typography.body, fontWeight: '700', color: theme.colors.text },
  line: { ...typography.body, color: theme.colors.text },
  player: { ...typography.label, color: theme.colors.textMuted },
}));
