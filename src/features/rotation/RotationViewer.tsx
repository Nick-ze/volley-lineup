import { Stack } from 'expo-router';

import { SlideTransition } from '@/components';
import type { SetNumber } from '@/domain/types';
import { useT } from '@/i18n';

import { Message } from './Message';
import { resolveSet, setNumbersOf } from './params';
import { RotationPanel } from './RotationPanel';
import { SetPicker } from './SetPicker';
import { useCorrectSetParam } from './useCorrectSetParam';
import { useMatchLineups } from './useMatchLineups';

export interface RotationViewerProps {
  matchId: string | undefined;
  setParam: string | string[] | undefined;
  onSelectSet: (set: SetNumber) => void;
}

/** Rotation viewer body: set tabs + the rotation panel of the selected set. */
export function RotationViewer({ matchId, setParam, onSelectSet }: RotationViewerProps) {
  const t = useT();
  const { match, sets, playersById } = useMatchLineups(matchId);
  const set = resolveSet(setParam, sets);
  useCorrectSetParam(setParam, set?.setNumber, onSelectSet);

  if (!match) return <Message text={t.rotation.matchNotFound} />;
  if (!set) return <Message text={t.rotation.noSets} />;

  return (
    <>
      <Stack.Screen options={{ title: t.rotation.title(set.setNumber) }} />
      <SetPicker sets={setNumbersOf(sets)} selected={set.setNumber} onSelect={onSelectSet} />
      {/* v8: another set slides in from the side of its tab (the swipe here steps rotations). */}
      <SlideTransition index={set.setNumber}>
        <RotationPanel key={set.setNumber} set={set} playersById={playersById} />
      </SlideTransition>
    </>
  );
}
