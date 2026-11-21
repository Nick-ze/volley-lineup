import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import { decidingSetNumber, needsSetup } from '@/domain/matchFlow';
import type { SetNumber } from '@/domain/types';
import { Message } from '@/features/rotation/Message';
import { SetPicker } from '@/features/rotation/SetPicker';
import { useT } from '@/i18n';

import { LiveSetView } from './LiveSetView';
import { MatchSummary } from './MatchSummary';
import { NextSetSetup } from './NextSetSetup';
import { useLiveSet } from './useLiveSet';

export interface LiveMatchProps {
  matchId: string | undefined;
  setNumber: SetNumber | undefined;
  onSelectSet: (set: SetNumber) => void;
  /** Opens the lineup builder for a set. */
  onEditLineup: (set: SetNumber) => void;
  /** Back to the match screen (from the match summary). */
  onBackToMatch: () => void;
  /** Optional content under the point buttons (e.g. point tagging after a rally). */
  belowPointButtons?: ReactNode;
}

/**
 * Live match mode, following the whole match: the set being played (score, serve, court,
 * undo, subs), a "set won" panel with the next set, the setup of a new set, and the match
 * summary once a side has won 3 sets.
 */
export function LiveMatch({
  matchId,
  setNumber,
  onSelectSet,
  onEditLineup,
  onBackToMatch,
  belowPointButtons,
}: LiveMatchProps) {
  const t = useT();
  const live = useLiveSet(matchId, setNumber);
  const { match, set, state, court, matchState } = live;

  if (!match || !matchState || setNumber === undefined) {
    return <Message text={t.live.matchNotFound} />;
  }
  const tabs = [...new Set([...match.sets.map((s) => s.setNumber), setNumber])].sort(
    (a, b) => a - b,
  );
  const picker =
    tabs.length > 1 ? <SetPicker sets={tabs} selected={setNumber} onSelect={onSelectSet} /> : null;
  const title = <Stack.Screen options={{ title: t.live.title(setNumber) }} />;
  const undo = () => {
    const target = live.undoLast();
    if (target !== null && target !== setNumber) onSelectSet(target);
  };

  if (decidingSetNumber(matchState) === setNumber) {
    return (
      <>
        {title}
        {picker}
        <MatchSummary
          state={matchState}
          opponent={match.opponent}
          onBack={onBackToMatch}
          onUndo={undo}
        />
      </>
    );
  }
  if (needsSetup(match, setNumber)) {
    return (
      <>
        {title}
        {picker}
        <NextSetSetup
          match={match}
          setNumber={setNumber}
          onSave={live.saveSet}
          onEdit={() => onEditLineup(setNumber)}
          undoSet={live.undoSet}
          onUndo={undo}
        />
      </>
    );
  }
  if (!set || !state || !court) {
    return (
      <>
        {picker}
        <Message text={t.live.noSet} />
      </>
    );
  }
  if (!live.complete) {
    return (
      <>
        {picker}
        <Message text={t.live.incomplete} />
      </>
    );
  }
  return (
    <>
      {title}
      {picker}
      <LiveSetView
        live={{ ...live, match, set, state, court, matchState }}
        onSelectSet={onSelectSet}
        belowPointButtons={belowPointButtons}
      />
    </>
  );
}
