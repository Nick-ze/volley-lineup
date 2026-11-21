import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { hasLaterPlay, nextSetNumber } from '@/domain/matchFlow';
import { setServeFirst } from '@/domain/lineupEditing';
import type { Match, SetLineup, SetNumber, Side } from '@/domain/types';
import type { LiveCourtView, LiveState } from '@/domain/liveSet';
import type { MatchState } from '@/domain/matchState';
import { ServeToggle } from '@/features/lineup/ServeToggle';
import { useT } from '@/i18n';
import { useIsWide } from '@/lib/useIsWide';
import { spacing } from '@/theme';

import { playerRef } from './format';
import { CONTROLS_COLUMN_WIDTH } from './layout';
import { LiveBanners } from './LiveBanners';
import { LiveCourt } from './LiveCourt';
import { PointButtons } from './PointButtons';
import { Scoreboard } from './Scoreboard';
import { SetWonPanel } from './SetWonPanel';
import { SubPanel } from './SubPanel';
import { UndoActions } from './UndoActions';
import type { LiveSet } from './useLiveSet';

export interface LiveSetViewProps {
  live: LiveSet & {
    match: Match;
    set: SetLineup;
    state: LiveState;
    court: LiveCourtView;
    matchState: MatchState;
  };
  onSelectSet: (set: SetNumber) => void;
  /** Optional content under the point buttons (e.g. point tagging after a rally). */
  belowPointButtons?: ReactNode;
}

/** One set played live: score, serve, rally buttons (or "set won"), court, undo and subs. */
export function LiveSetView({ live, onSelectSet, belowPointButtons }: LiveSetViewProps) {
  const t = useT();
  const wide = useIsWide();
  const [subMode, setSubMode] = useState(false);
  const [outId, setOutId] = useState<string | null>(null);
  const { match, set, state, court, playersById, matchState } = live;
  const won = state.setWinner;

  const ref = (id: string | null) => playerRef(t, playersById, id);
  const reset = () => {
    setSubMode(false);
    setOutId(null);
  };
  const point = (winner: Side) => {
    reset();
    live.point(winner);
  };
  const undo = () => {
    reset();
    const target = live.undoLast();
    if (target !== null && target !== set.setNumber) onSelectSet(target);
  };
  const pressCourt = (id: string) => {
    setSubMode(true);
    setOutId((cur) => (cur === id ? null : id));
  };
  const pickIn = (inId: string) => {
    if (outId) live.substitute(outId, inId);
    reset();
  };
  const serveText =
    state.servingSide === 'us'
      ? t.live.weServe(state.serverId ? (playersById.get(state.serverId)?.number ?? null) : null)
      : t.live.theyServe(match.opponent);
  const next = nextSetNumber(set.setNumber);
  const nextPlayed = !!next && match.sets.some((s) => s.setNumber === next && s.events.length > 0);
  const last = set.events[set.events.length - 1];

  const play = won ? (
    <SetWonPanel
      setNumber={set.setNumber}
      winner={won}
      score={state.score}
      opponent={match.opponent}
      next={next}
      nextPlayed={nextPlayed}
      onNext={onSelectSet}
      onUndo={hasLaterPlay(match, set.setNumber) ? null : undo}
    />
  ) : (
    <>
      {set.events.length === 0 ? (
        <ServeToggle
          weServeFirst={set.weServeFirst}
          onChange={(v) => live.saveSet(setServeFirst(set, v))}
        />
      ) : null}
      <PointButtons opponent={match.opponent} onPoint={point} />
      {belowPointButtons}
      <UndoActions
        last={last}
        acrossSet={!last && live.undoSet !== null ? live.undoSet : null}
        playersById={playersById}
        onUndo={undo}
        onReset={() => {
          reset();
          live.resetLive();
        }}
      />
    </>
  );

  const controls = (
    <View style={styles.column}>
      <Scoreboard
        setNumber={set.setNumber}
        opponent={match.opponent}
        score={state.score}
        setsWon={matchState.setsWon}
        servingSide={state.servingSide}
        serveText={serveText}
        rotation={state.rotation}
      />
      <LiveBanners state={state} opponent={match.opponent} playersById={playersById} />
      {play}
    </View>
  );
  const courtAndSubs = (
    <View style={styles.column}>
      <LiveCourt
        view={court}
        playersById={playersById}
        serverId={state.serverId}
        selectedId={outId}
        onPressPlayer={pressCourt}
        readOnly={!!won}
      />
      {won ? null : (
        <SubPanel
          subsUsed={state.subsUsed}
          active={subMode}
          outRef={outId ? ref(outId) : null}
          bench={live.bench}
          liberoRef={set.liberoId ? ref(set.liberoId) : null}
          onStart={() => setSubMode(true)}
          onCancel={reset}
          onPickIn={pickIn}
          warningsFor={(inId) => (outId ? live.preview(outId, inId) : [])}
        />
      )}
    </View>
  );

  return wide ? (
    <View style={styles.wide}>
      <View style={styles.controls}>{controls}</View>
      <View style={styles.fill}>{courtAndSubs}</View>
    </View>
  ) : (
    <>
      {controls}
      {courtAndSubs}
    </>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.md },
  wide: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  controls: { width: CONTROLS_COLUMN_WIDTH },
  fill: { flex: 1 },
});
