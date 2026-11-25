import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { setServeFirst } from '@/domain/lineupEditing';
import type { LiveCourtView, LiveState } from '@/domain/liveSet';
import { hasLaterPlay, nextSetNumber } from '@/domain/matchFlow';
import type { MatchState } from '@/domain/matchState';
import type { Match, SetLineup, SetNumber, Side } from '@/domain/types';
import { useT } from '@/i18n';
import { useIsWide } from '@/lib/useIsWide';
import { spacing } from '@/theme';

import { playerRef, tagDetail } from './format';
import { CONTROLS_COLUMN_WIDTH } from './layout';
import { LiveBanners } from './LiveBanners';
import { LiveCourt } from './LiveCourt';
import { RallyControls } from './RallyControls';
import { Scoreboard } from './Scoreboard';
import { SetWonPanel } from './SetWonPanel';
import { SubPanel } from './SubPanel';
import type { LiveSet } from './useLiveSet';
import { useSubFlow } from './useSubFlow';

export interface LiveSetViewProps {
  live: LiveSet & {
    match: Match;
    set: SetLineup;
    state: LiveState;
    court: LiveCourtView;
    matchState: MatchState;
  };
  /** Go to (start) the next set. */
  onNext: (set: SetNumber) => void;
  /** Undo (possibly across a set end). */
  onUndo: () => void;
  /** Optional content under the point buttons (e.g. point tagging after a rally). */
  belowPointButtons?: ReactNode;
  /**
   * v10: watch only (a view-only member, or the match is scored on another device): score,
   * banners and court, without rally, undo and substitution controls.
   */
  readOnly?: boolean;
}

/** One set played live: score, serve, rally buttons (or "set won"), court, undo and subs. */
export function LiveSetView({
  live,
  onNext,
  onUndo,
  belowPointButtons,
  readOnly = false,
}: LiveSetViewProps) {
  const t = useT();
  const wide = useIsWide();
  const sub = useSubFlow();
  const { reset } = sub;
  const { match, set, state, court, playersById, matchState } = live;
  const won = state.setWinner;
  const ref = (id: string | null) => playerRef(t, playersById, id);
  const serveText =
    state.servingSide === 'us'
      ? t.live.weServe(state.serverId ? (playersById.get(state.serverId)?.number ?? null) : null)
      : t.live.theyServe(match.opponent);
  const next = nextSetNumber(set.setNumber);
  const last = set.events[set.events.length - 1];
  // A watcher can only go to a next set that is already on its way (never start one).
  const nextExists = match.sets.some((s) => s.setNumber === next);

  // The set's winning rally can still be tagged: the tag row stays under the "set won" panel.
  const play = won ? (
    <>
      <SetWonPanel
        setNumber={set.setNumber}
        winner={won}
        score={state.score}
        opponent={match.opponent}
        next={readOnly && !nextExists ? null : next}
        nextPlayed={readOnly || match.sets.some((s) => s.setNumber === next && s.events.length > 0)}
        onNext={onNext}
        onUndo={readOnly || hasLaterPlay(match, set.setNumber) ? null : onUndo}
        tagDetail={last?.type === 'point' ? tagDetail(t, playersById, last) : null}
      />
      {belowPointButtons}
    </>
  ) : readOnly ? null : (
    <RallyControls
      opponent={match.opponent}
      last={last}
      weServeFirst={last ? null : set.weServeFirst}
      onServeChange={(v) => live.saveSet(setServeFirst(set, v))}
      acrossSet={last ? null : live.undoSet}
      playersById={playersById}
      onPoint={(winner: Side) => {
        reset();
        live.point(winner);
      }}
      onUndo={() => {
        reset();
        onUndo();
      }}
      onReset={() => {
        reset();
        live.resetLive();
      }}
      belowPointButtons={belowPointButtons}
    />
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
        rotation={state.setterRotation ?? state.rotation}
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
        teamId={match.teamId}
        roles={state.roles}
        serverId={state.serverId}
        selectedId={sub.outId}
        onPressPlayer={sub.pickOut}
        readOnly={!!won || readOnly}
      />
      {won || readOnly ? null : (
        <SubPanel
          subsUsed={state.subsUsed}
          active={sub.active}
          outRef={sub.outId ? ref(sub.outId) : null}
          bench={live.bench}
          liberoRef={set.liberoId ? ref(set.liberoId) : null}
          onStart={sub.start}
          onCancel={reset}
          onPickIn={(inId) => {
            if (sub.outId) live.substitute(sub.outId, inId);
            reset();
          }}
          warningsFor={(inId) => (sub.outId ? live.preview(sub.outId, inId) : [])}
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

// v8 QA: small gaps, so the court and Substitution fit at 390×844 (DECISIONS #126).
const styles = StyleSheet.create({
  column: { gap: spacing.sm },
  wide: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  controls: { width: CONTROLS_COLUMN_WIDTH },
  fill: { flex: 1 },
});
