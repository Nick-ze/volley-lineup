import { useMemo } from 'react';
import { View } from 'react-native';

import { matchPerformance, performanceRows } from '@/domain/performance';
import type { Match, Player, SetNumber } from '@/domain/types';
import { makeStyles, spacing } from '@/theme';

import { PerformanceCard } from './PerformanceCard';
import { PerformanceLegend } from './PerformanceLegend';
import { PlayerPerformanceDetail } from './PlayerPerformanceDetail';

export interface PerformancePageProps {
  match: Match;
  players: Player[];
  setNumber: SetNumber | null;
  /** The open player (they have a line in this set), else the overview. */
  playerId: string | undefined;
  onBack: () => void;
  onOpenPlayer: (playerId: string) => void;
}

/** v8.1 (also the pager's neighbour page): one set's (or all sets') cards and legend, or the open player's detail. */
export function PerformancePage({
  match,
  players,
  setNumber,
  playerId,
  ...on
}: PerformancePageProps) {
  const styles = useStyles();
  const perf = useMemo(
    () => matchPerformance(match, players, setNumber),
    [match, players, setNumber],
  );
  const rows = useMemo(() => performanceRows(perf, players), [perf, players]);
  const detail = rows.find((r) => r.player.id === playerId);
  if (detail) {
    return (
      <PlayerPerformanceDetail
        player={detail.player}
        performance={detail.performance}
        totalRallies={perf.rallies}
        onBack={on.onBack}
      />
    );
  }
  return (
    <>
      <View style={styles.list}>
        {rows.map(({ player, performance }) => (
          <PerformanceCard
            key={player.id}
            player={player}
            performance={performance}
            onPress={() => on.onOpenPlayer(player.id)}
          />
        ))}
      </View>
      <PerformanceLegend />
    </>
  );
}

const useStyles = makeStyles(() => ({
  list: { gap: spacing.sm },
}));
