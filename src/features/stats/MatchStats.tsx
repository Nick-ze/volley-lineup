import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { SwipeTabs } from '@/components';
import { matchStats, playedSetNumbers } from '@/domain/stats';
import type { Match, SetNumber } from '@/domain/types';
import { useListStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { usePlayersForTeam } from '@/store';
import { makeStyles, spacing, typography } from '@/theme';

import { PlayerTable } from './PlayerTable';
import { RotationTable } from './RotationTable';
import { SetFilter } from './SetFilter';

/** One match's rotation and player tables, for all sets or one played set. */
export function MatchStats({ match }: { match: Match }) {
  const listStyles = useListStyles();
  const styles = useStyles();
  const t = useT();
  const players = usePlayersForTeam(match.teamId);
  const sets = useMemo(() => playedSetNumbers(match), [match]);
  const [filter, setFilter] = useState<SetNumber | null>(null);
  // A filter for a set that is no longer played (e.g. after Reset) falls back to all sets.
  const setNumber = filter !== null && sets.includes(filter) ? filter : null;
  const stats = useMemo(() => matchStats(match, players, setNumber), [match, players, setNumber]);

  // The opponent goes here, not in the header, so long names wrap instead of overflowing.
  const heading = (
    <Text style={listStyles.heading} accessibilityRole="header" testID="match-stats-heading">
      {t.stats.matchTitle(match.opponent)}
    </Text>
  );
  if (sets.length === 0) {
    return (
      <View style={styles.wrap}>
        {heading}
        <Text style={listStyles.empty} testID="match-stats-empty">
          {t.stats.matchEmpty}
        </Text>
      </View>
    );
  }
  const { us, them } = stats.points;
  // v8: the filter's tabs in order (All sets first): the tables slide / swipe between them.
  const filters = [null, ...sets];
  return (
    <View style={styles.wrap} testID="match-stats">
      {heading}
      <SetFilter sets={sets} value={setNumber} onChange={setFilter} />
      <SwipeTabs
        tabs={filters}
        value={setNumber}
        onChange={setFilter}
        testID="stats-set-swipe"
        contentStyle={styles.wrap}
      >
        <Text
          style={styles.points}
          accessibilityLabel={t.stats.season.pointsLabel(us, them)}
          testID="match-stats-points"
        >
          {`${t.stats.season.points} ${t.stats.score(us, them)}`}
        </Text>
        <RotationTable stats={stats} />
        <PlayerTable stats={stats} players={players} />
      </SwipeTabs>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.lg },
  points: { ...typography.subheading, color: theme.colors.text },
}));
