import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { seasonOverview, seasonStats } from '@/domain/stats';
import { defaultStatsSeasonId } from '@/domain/statsSeason';
import { useListStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { useMatchesForTeam, usePlayersForTeam, useSeasonsForTeam } from '@/store';
import { makeStyles, spacing } from '@/theme';

import { PlayerTable } from './PlayerTable';
import { RotationTable } from './RotationTable';
import { SeasonFilter } from './SeasonFilter';
import { SeasonOverview } from './SeasonOverview';

/**
 * The team's record, sets and points, then rotation and player tables. v7.0: for one season
 * or all of them (a switcher once the team has two or more seasons; it opens on the newest
 * season with a played match).
 */
export function StatsTab({ teamId }: { teamId: string }) {
  const listStyles = useListStyles();
  const styles = useStyles();
  const t = useT();
  const all = useMatchesForTeam(teamId);
  const seasons = useSeasonsForTeam(teamId);
  const players = usePlayersForTeam(teamId);
  const [chosen, setChosen] = useState(() => defaultStatsSeasonId(seasons, all));
  // A deleted season falls back to all seasons.
  const seasonId = seasons.some((s) => s.id === chosen) ? chosen : null;
  const matches = useMemo(
    () => (seasonId === null ? all : all.filter((m) => m.seasonId === seasonId)),
    [all, seasonId],
  );
  const overview = useMemo(() => seasonOverview(matches), [matches]);
  const stats = useMemo(() => seasonStats(matches, players), [matches, players]);
  const anyPlayed = useMemo(() => seasonOverview(all).played > 0, [all]);

  if (!anyPlayed) {
    return (
      <Text style={listStyles.empty} testID="stats-empty">
        {t.stats.empty}
      </Text>
    );
  }
  return (
    <View style={styles.wrap} testID="stats-tab">
      {seasons.length > 1 ? (
        <SeasonFilter seasons={seasons} value={seasonId} onChange={setChosen} />
      ) : null}
      {overview.played === 0 ? (
        <Text style={listStyles.empty} testID="stats-season-empty">
          {t.stats.seasonFilter.empty}
        </Text>
      ) : (
        <>
          <SeasonOverview
            overview={overview}
            heading={seasons.find((s) => s.id === seasonId)?.name ?? t.stats.seasonFilter.all}
          />
          <RotationTable stats={stats} />
          <PlayerTable stats={stats} players={players} />
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.lg },
}));
