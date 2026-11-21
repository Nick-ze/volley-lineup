import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { matchStats, playedSetNumbers } from '@/domain/stats';
import type { Match, SetNumber } from '@/domain/types';
import { listStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { usePlayersForTeam } from '@/store';
import { colors, spacing, typography } from '@/theme';

import { PlayerTable } from './PlayerTable';
import { RotationTable } from './RotationTable';
import { SetFilter } from './SetFilter';

/** One match's rotation and player tables, for all sets or one played set. */
export function MatchStats({ match }: { match: Match }) {
  const t = useT();
  const players = usePlayersForTeam(match.teamId);
  const sets = useMemo(() => playedSetNumbers(match), [match]);
  const [filter, setFilter] = useState<SetNumber | null>(null);
  // A filter for a set that is no longer played (e.g. after Reset) falls back to all sets.
  const setNumber = filter !== null && sets.includes(filter) ? filter : null;
  const stats = useMemo(() => matchStats(match, players, setNumber), [match, players, setNumber]);

  if (sets.length === 0) {
    return (
      <Text style={listStyles.empty} testID="match-stats-empty">
        {t.stats.matchEmpty}
      </Text>
    );
  }
  const { us, them } = stats.points;
  return (
    <View style={styles.wrap} testID="match-stats">
      <SetFilter sets={sets} value={setNumber} onChange={setFilter} />
      <Text
        style={styles.points}
        accessibilityLabel={t.stats.season.pointsLabel(us, them)}
        testID="match-stats-points"
      >
        {`${t.stats.season.points} ${t.stats.score(us, them)}`}
      </Text>
      <RotationTable stats={stats} />
      <PlayerTable stats={stats} players={players} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  points: { ...typography.subheading, color: colors.text },
});
