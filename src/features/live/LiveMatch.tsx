import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { SlideTransition } from '@/components';

import {
  decidingSetNumber,
  isAfterDecision,
  needsSetup,
  withDefaultServe,
} from '@/domain/matchFlow';
import type { SetNumber } from '@/domain/types';
import { Message } from '@/features/rotation/Message';
import { SetPicker } from '@/features/rotation/SetPicker';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { tagDetail } from './format';
import { LiveSetView } from './LiveSetView';
import { MatchSummary } from './MatchSummary';
import { NextSetSetup } from './NextSetSetup';
import { useLiveSet } from './useLiveSet';
import { usePointTagging } from './usePointTagging';

export interface LiveMatchProps {
  matchId: string | undefined;
  setNumber: SetNumber | undefined;
  onSelectSet: (set: SetNumber) => void;
  /** Opens the lineup builder for a set. */
  onEditLineup: (set: SetNumber) => void;
  /** Back to the match screen (from the match summary). */
  onBackToMatch: () => void;
  /** v8: the set shown before this one (this is remounted per set): it slides in from that side. */
  previousSet?: SetNumber | null;
}

/**
 * Live match mode, following the whole match: the set being played (score, serve, court,
 * undo, subs), a "set won" panel with the next set, the setup of a new set, and the match
 * summary once a side has won 3 sets. Under the point buttons: optional tags of the last rally.
 */
export function LiveMatch({
  matchId,
  setNumber,
  onSelectSet,
  onEditLineup,
  onBackToMatch,
  previousSet = null,
}: LiveMatchProps) {
  const t = useT();
  const { live, row: tagRow } = usePointTagging(useLiveSet(matchId, setNumber));
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

  /** Start (or go to) the next set; reached from the previous set, it gets the default serve. */
  const goToNext = (next: SetNumber) => {
    const prepared = withDefaultServe(match, next);
    if (prepared) live.saveSet(prepared);
    onSelectSet(next);
  };
  const screen = (content: ReactNode) => (
    <>
      {title}
      {picker}
      {/* v8: another set slides in from the side of its tab. */}
      <SlideTransition index={setNumber} fromIndex={previousSet} contentStyle={styles.content}>
        {content}
      </SlideTransition>
    </>
  );

  if (decidingSetNumber(matchState) === setNumber) {
    // The match-winning rally can still be tagged: the tag row stays under the summary.
    const last = set?.events[set.events.length - 1];
    return screen(
      <>
        <MatchSummary
          state={matchState}
          opponent={match.opponent}
          onBack={onBackToMatch}
          onUndo={undo}
          tagDetail={last?.type === 'point' ? tagDetail(t, live.playersById, last) : null}
        />
        {tagRow}
      </>,
    );
  }
  if (isAfterDecision(matchState, setNumber))
    return screen(<Message text={t.live.afterDecision} />);
  if (needsSetup(match, setNumber)) {
    return screen(
      <NextSetSetup
        match={match}
        setNumber={setNumber}
        onSave={live.saveSet}
        onEdit={() => onEditLineup(setNumber)}
        undoSet={live.undoSet}
        onUndo={undo}
      />,
    );
  }
  if (!set || !state || !court) return screen(<Message text={t.live.noSet} />);
  if (!live.complete) return screen(<Message text={t.live.incomplete} />);
  return screen(
    <LiveSetView
      live={{ ...live, match, set, state, court, matchState }}
      onNext={goToNext}
      onUndo={undo}
      belowPointButtons={tagRow}
    />,
  );
}

// The screen's gap between its parts, also inside the slide.
// v8 QA: a medium gap keeps the court and Substitution within 390×844 (DECISIONS #126).
const styles = StyleSheet.create({ content: { gap: spacing.md } });
