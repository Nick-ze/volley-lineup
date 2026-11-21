import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { matchPerformance, performanceRows } from '@/domain/performance';
import { playedSetNumbers } from '@/domain/stats';
import type { Match, SetNumber } from '@/domain/types';
import { listStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { usePlayersForTeam } from '@/store';
import { spacing } from '@/theme';

import { PerformanceCard } from './PerformanceCard';
import { PerformanceLegend } from './PerformanceLegend';
import { PlayerPerformanceDetail } from './PlayerPerformanceDetail';
import { SetSwitch } from './SetSwitch';

export interface MatchPerformanceProps {
  match: Match;
  /** The `set` URL param: a played set's number, else all sets. */
  setParam: string | undefined;
  /** The `player` URL param: shows that player's detail when they have a line. */
  playerParam: string | undefined;
  /** Updates the URL params (`set`: number or 'all'; `player`: id or undefined). */
  onParams: (params: { set: string; player: string | undefined }) => void;
  /** Opens a player's detail as a new history entry (so Back returns to the overview). */
  onOpenPlayer: (params: { set: string; player: string }) => void;
}

/** The performance view: set switcher, then every player's card, or one player's detail. */
export function MatchPerformance({
  match,
  setParam,
  playerParam,
  onParams,
  onOpenPlayer,
}: MatchPerformanceProps) {
  const t = useT();
  const players = usePlayersForTeam(match.teamId);
  const sets = useMemo(() => playedSetNumbers(match), [match]);
  // An invalid, missing or unplayed set falls back to all sets.
  const requested = Number(setParam);
  const setNumber = sets.find((n) => n === requested) ?? null;
  const perf = useMemo(
    () => matchPerformance(match, players, setNumber),
    [match, players, setNumber],
  );
  const rows = useMemo(() => performanceRows(perf, players), [perf, players]);
  const setKey = setNumber === null ? 'all' : String(setNumber);
  const detail = rows.find((r) => r.player.id === playerParam);

  const heading = (
    <Text style={listStyles.heading} accessibilityRole="header" testID="perf-heading">
      {t.performance.heading(match.opponent)}
    </Text>
  );
  if (sets.length === 0) {
    return (
      <View style={styles.wrap}>
        {heading}
        <Text style={listStyles.empty} testID="perf-empty">
          {t.performance.empty}
        </Text>
      </View>
    );
  }
  // Keep the open player only if they have a line in the new set (else the overview, with no
  // stale `player` in the URL — v6 QA).
  const switchSet = (n: SetNumber | null) => {
    const keep =
      detail !== undefined && matchPerformance(match, players, n).players[detail.player.id];
    onParams({ set: n === null ? 'all' : String(n), player: keep ? detail.player.id : undefined });
  };

  return (
    <View style={styles.wrap} testID="performance">
      {heading}
      <SetSwitch sets={sets} value={setNumber} onChange={switchSet} />
      {detail ? (
        <PlayerPerformanceDetail
          player={detail.player}
          performance={detail.performance}
          totalRallies={perf.rallies}
          onBack={() => onParams({ set: setKey, player: undefined })}
        />
      ) : (
        <>
          <View style={styles.list}>
            {rows.map(({ player, performance }) => (
              <PerformanceCard
                key={player.id}
                player={player}
                performance={performance}
                onPress={() => onOpenPlayer({ set: setKey, player: player.id })}
              />
            ))}
          </View>
          <PerformanceLegend />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  list: { gap: spacing.sm },
});
