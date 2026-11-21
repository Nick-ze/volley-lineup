import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { seasonOverview, seasonStats } from '@/domain/stats';
import { listStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { useMatchesForTeam, usePlayersForTeam } from '@/store';
import { spacing } from '@/theme';

import { PlayerTable } from './PlayerTable';
import { RotationTable } from './RotationTable';
import { SeasonOverview } from './SeasonOverview';

/** The team's season: record, sets and points, then rotation and player tables. */
export function StatsTab({ teamId }: { teamId: string }) {
  const t = useT();
  const matches = useMatchesForTeam(teamId);
  const players = usePlayersForTeam(teamId);
  const overview = useMemo(() => seasonOverview(matches), [matches]);
  const stats = useMemo(() => seasonStats(matches, players), [matches, players]);

  if (overview.played === 0) {
    return (
      <Text style={listStyles.empty} testID="stats-empty">
        {t.stats.empty}
      </Text>
    );
  }
  return (
    <View style={styles.wrap} testID="stats-tab">
      <SeasonOverview overview={overview} />
      <RotationTable stats={stats} />
      <PlayerTable stats={stats} players={players} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});
