import { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner, Button, useFormStyles } from '@/components';
import {
  addPoint,
  endSet,
  flippedState,
  lastPoint,
  liveStateOf,
  liveStats,
  liveStatus,
  matchOutcome,
  playerLabelOf,
  tagLastPoint,
  undoLast,
  type LiveState,
  type PlanMatch,
} from '@/domain/hostedTournament';
import type { HostedPlanKind, HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore, useHostedPlayers, type HostedMatchRef } from '@/store';
import { makeStyles, spacing } from '@/theme';

import { LiveBoard } from './LiveBoard';
import { LivePointButtons } from './LivePointButtons';
import { LiveStatsPanel } from './LiveStatsPanel';
import { LiveTagRow } from './LiveTagRow';

export interface HostedLiveProps {
  tournament: HostedTournament;
  kind: HostedPlanKind;
  match: PlanMatch;
  onDone: () => void;
}

/**
 * v12.2: live scoring of a tournament match — only the score. A point for either team, undo,
 * and "End set" (a hosted tournament has no rule on a set's length, so the scorer says when a
 * set is over); the next point starts the next set; the match is over by the tournament's
 * format. After a point the optional questions: how it was won and, when the team has players,
 * by whom. Every step is stored at once.
 */
export function HostedLive({ tournament, kind, match, onDone }: HostedLiveProps) {
  const formStyles = useFormStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.live;
  const { teamA, teamB, result } = match;
  const playersA = useHostedPlayers(teamA.id);
  const playersB = useHostedPlayers(teamB.id);
  // The questions are open after a point until closed, undone, or the set ends.
  const [asking, setAsking] = useState(false);

  // The state as seen from the plan's first team (a result is stored that way; a file may not be).
  const stored = liveStateOf(result);
  const state = result && result.teamAId !== teamA.id ? flippedState(stored) : stored;
  const status = liveStatus(state, tournament);
  const last = lastPoint(state);
  const outcome = matchOutcome(state.sets, tournament);
  const stats = liveStats(state.live);

  const ref: HostedMatchRef =
    kind === 'manual' && result
      ? { matchId: result.id }
      : { tournamentId: tournament.id, teamAId: teamA.id, teamBId: teamB.id };
  const save = (next: LiveState) => useAppStore.getState().saveHostedLive(ref, next);
  const sides = {
    a: { name: teamA.name, players: playersA, label: playerLabelOf(teamA) },
    b: { name: teamB.name, players: playersB, label: playerLabelOf(teamB) },
  };
  const lastSet = state.sets[state.sets.length - 1];

  return (
    <View style={styles.wrap}>
      <LiveBoard
        setNumber={status.setNumber}
        teamA={teamA.name}
        teamB={teamB.name}
        scoreA={status.score.a}
        scoreB={status.score.b}
        setsA={status.setsA}
        setsB={status.setsB}
      />
      {status.phase === 'over' ? (
        <Banner testID="live-over">
          {outcome.winner === 'draw'
            ? s.over.draw(outcome.setsA, outcome.setsB)
            : outcome.winner === 'a'
              ? s.over.win(teamA.name, outcome.setsA, outcome.setsB)
              : s.over.win(teamB.name, outcome.setsB, outcome.setsA)}
        </Banner>
      ) : null}
      {status.phase === 'between' && lastSet ? (
        <Text style={formStyles.hint} testID="live-between">
          {`${s.between(state.sets.length, lastSet.a, lastSet.b)} ${s.nextSet(status.setNumber)}`}
        </Text>
      ) : null}
      {status.phase === 'over' ? null : (
        <LivePointButtons
          teamA={teamA.name}
          teamB={teamB.name}
          onPoint={(team) => {
            save(addPoint(state, team, tournament));
            setAsking(true);
          }}
        />
      )}
      {asking && last ? (
        <LiveTagRow
          point={last}
          sides={sides}
          onTag={(pointKind, playerId) => save(tagLastPoint(state, pointKind, playerId))}
          onClose={() => setAsking(false)}
        />
      ) : null}
      <View style={styles.controls}>
        <Button
          label={s.undo}
          accessibilityLabel={
            status.phase === 'playing'
              ? s.undoLabel
              : s.undoSetLabel(Math.max(1, state.sets.length))
          }
          variant="secondary"
          icon="arrow-undo"
          disabled={!status.canUndo}
          onPress={() => {
            save(undoLast(state));
            setAsking(false);
          }}
          style={styles.control}
          testID="live-undo"
        />
        {status.phase === 'over' ? (
          <Button label={s.done} onPress={onDone} style={styles.control} testID="live-done" />
        ) : (
          <Button
            label={s.endSet(status.setNumber)}
            accessibilityHint={s.endSetHint}
            variant="secondary"
            disabled={!status.canEndSet}
            onPress={() => {
              save(endSet(state));
              setAsking(false);
            }}
            style={styles.control}
            testID="live-end-set"
          />
        )}
      </View>
      <LiveStatsPanel
        sides={[
          { ...sides.a, stats: stats.a },
          { ...sides.b, stats: stats.b },
        ]}
        empty={s.stats.none}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.md },
  controls: { flexDirection: 'row', gap: spacing.sm },
  control: { flex: 1 },
}));
