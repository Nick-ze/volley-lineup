import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { SwipeTabs } from '@/components';
import { matchPerformance, performanceRows } from '@/domain/performance';
import { playedSetNumbers } from '@/domain/stats';
import type { Match, SetNumber } from '@/domain/types';
import { useListStyles } from '@/features/roster/components/styles';
import { SetChipFilter } from '@/features/stats/SetChipFilter';
import { useT } from '@/i18n';
import { usePlayersForTeam } from '@/store';
import { makeStyles, spacing } from '@/theme';

import { PerformancePage } from './PerformancePage';

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
  const listStyles = useListStyles();
  const styles = useStyles();
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
  const setKey = setNumber === null ? 'all' : String(setNumber);
  const rows = useMemo(() => performanceRows(perf, players), [perf, players]);
  // The open player, if they have a line in this set (else the overview).
  const openPlayer = rows.find((r) => r.player.id === playerParam)?.player.id;

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
  const keptPlayer = (n: SetNumber | null) =>
    openPlayer !== undefined && matchPerformance(match, players, n).players[openPlayer]
      ? openPlayer
      : undefined;
  const switchSet = (n: SetNumber | null) =>
    onParams({ set: n === null ? 'all' : String(n), player: keptPlayer(n) });

  return (
    <View style={styles.wrap} testID="performance">
      {heading}
      <SetChipFilter
        sets={sets}
        value={setNumber}
        onChange={switchSet}
        strings={t.performance.filter}
        testIDPrefix="perf-set"
        allPosition="last"
      />
      {/* v8: the switch's tabs in order (All sets last): the cards slide / swipe between them. */}
      <SwipeTabs
        tabs={[...sets, null]}
        value={setNumber}
        onChange={switchSet}
        renderTab={(n) => (
          <PerformancePage
            match={match}
            players={players}
            setNumber={n}
            playerId={n === setNumber ? openPlayer : keptPlayer(n)}
            onBack={() => onParams({ set: setKey, player: undefined })}
            onOpenPlayer={(id) => onOpenPlayer({ set: setKey, player: id })}
          />
        )}
        testID="perf-set-swipe"
        contentStyle={styles.wrap}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.lg },
}));
