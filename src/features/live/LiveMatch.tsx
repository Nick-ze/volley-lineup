import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components';
import type { SetEvent, SetNumber, Side } from '@/domain/types';
import { Message } from '@/features/rotation/Message';
import { SetPicker } from '@/features/rotation/SetPicker';
import { t } from '@/i18n/en';
import { useIsWide } from '@/lib/useIsWide';
import { spacing } from '@/theme';

import { playerRef } from './format';
import { CONTROLS_COLUMN_WIDTH } from './layout';
import { LiveBanners } from './LiveBanners';
import { LiveCourt } from './LiveCourt';
import { PointButtons } from './PointButtons';
import { Scoreboard } from './Scoreboard';
import { SubPanel } from './SubPanel';
import { useLiveSet } from './useLiveSet';

export interface LiveMatchProps {
  matchId: string | undefined;
  setNumber: SetNumber | undefined;
  onSelectSet: (set: SetNumber) => void;
}

/** Live match mode for one set: score, serve, current court, undo and substitutions. */
export function LiveMatch({ matchId, setNumber, onSelectSet }: LiveMatchProps) {
  const live = useLiveSet(matchId, setNumber);
  const wide = useIsWide();
  const [subMode, setSubMode] = useState(false);
  const [outId, setOutId] = useState<string | null>(null);
  const { match, set, state, playersById } = live;

  if (!match) return <Message text={t.live.matchNotFound} />;
  const picker =
    match.sets.length > 1 && set ? (
      <SetPicker
        sets={match.sets.map((s) => s.setNumber)}
        selected={set.setNumber}
        onSelect={onSelectSet}
      />
    ) : null;
  if (!set || !state) return <Message text={t.live.noSet} />;
  if (!live.complete) {
    return (
      <>
        {picker}
        <Message text={t.live.incomplete} />
      </>
    );
  }

  const ref = (id: string | null) => playerRef(playersById, id);
  const reset = () => {
    setSubMode(false);
    setOutId(null);
  };
  const point = (winner: Side) => {
    reset();
    live.point(winner);
  };
  const pressCourt = (id: string) => {
    setSubMode(true);
    setOutId((cur) => (cur === id ? null : id));
  };
  const pickIn = (inId: string) => {
    if (outId) live.substitute(outId, inId);
    reset();
  };
  const last: SetEvent | undefined = set.events[set.events.length - 1];
  const undoLabel = !last
    ? t.live.undoNothing
    : last.type === 'point'
      ? t.live.undoPoint(last.winner === 'us')
      : t.live.undoSub(ref(last.outPlayerId), ref(last.inPlayerId));
  const serveText =
    state.servingSide === 'us'
      ? t.live.weServe(state.serverId ? (playersById.get(state.serverId)?.number ?? null) : null)
      : t.live.theyServe(match.opponent);

  const controls = (
    <View style={styles.column}>
      <Scoreboard
        setNumber={set.setNumber}
        opponent={match.opponent}
        score={state.score}
        servingSide={state.servingSide}
        serveText={serveText}
        rotation={state.rotation}
      />
      <LiveBanners state={state} opponent={match.opponent} playersById={playersById} />
      <PointButtons opponent={match.opponent} onPoint={point} />
      <Button
        label={t.live.undo}
        accessibilityLabel={undoLabel}
        variant="secondary"
        disabled={!last}
        onPress={() => {
          reset();
          live.undoLast();
        }}
        testID="undo"
      />
    </View>
  );
  const courtAndSubs = (
    <View style={styles.column}>
      <LiveCourt
        slots={state.slots}
        playersById={playersById}
        serverId={state.serverId}
        selectedId={outId}
        onPressPlayer={pressCourt}
      />
      <SubPanel
        subsUsed={state.subsUsed}
        active={subMode}
        outRef={outId ? ref(outId) : null}
        bench={live.bench}
        liberoRef={set.liberoId ? ref(set.liberoId) : null}
        onStart={() => setSubMode(true)}
        onCancel={reset}
        onPickIn={pickIn}
      />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t.live.title(set.setNumber) }} />
      {picker}
      {wide ? (
        <View style={styles.wide}>
          <View style={styles.controls}>{controls}</View>
          <View style={styles.fill}>{courtAndSubs}</View>
        </View>
      ) : (
        <>
          {controls}
          {courtAndSubs}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.md },
  wide: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  controls: { width: CONTROLS_COLUMN_WIDTH },
  fill: { flex: 1 },
});
