import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { seasonOverview, seasonStats } from '@/domain/stats';
import { listStyles } from '@/features/roster/components/styles';
import { PlayerTable } from '@/features/stats/PlayerTable';
import { RotationTable } from '@/features/stats/RotationTable';
import { SeasonOverview } from '@/features/stats/SeasonOverview';
import { useT } from '@/i18n';
import { useMatchesForSeason, usePlayersForTeam, useSeason } from '@/store';
import { spacing } from '@/theme';

/** The season's record, sets and points, then rotation and player tables (only its matches). */
export function SeasonStats({ teamId, seasonId }: { teamId: string; seasonId: string }) {
  const t = useT();
  const matches = useMatchesForSeason(seasonId);
  const season = useSeason(seasonId);
  const players = usePlayersForTeam(teamId);
  const overview = useMemo(() => seasonOverview(matches), [matches]);
  const stats = useMemo(() => seasonStats(matches, players), [matches, players]);

  if (overview.played === 0) {
    return (
      <Text style={listStyles.empty} testID="season-stats-empty">
        {t.seasons.stats.empty}
      </Text>
    );
  }
  return (
    <View style={styles.wrap} testID="season-stats">
      <SeasonOverview overview={overview} heading={season?.name} />
      <RotationTable stats={stats} />
      <PlayerTable stats={stats} players={players} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
});
