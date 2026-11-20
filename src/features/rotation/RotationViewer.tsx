import { Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import type { SetNumber } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, typography } from '@/theme';

import { resolveSet, setNumbersOf } from './params';
import { RotationPanel } from './RotationPanel';
import { SetPicker } from './SetPicker';
import { useMatchLineups } from './useMatchLineups';

export interface RotationViewerProps {
  matchId: string | undefined;
  setParam: string | string[] | undefined;
  onSelectSet: (set: SetNumber) => void;
}

/** Rotation viewer body: set tabs + the rotation panel of the selected set. */
export function RotationViewer({ matchId, setParam, onSelectSet }: RotationViewerProps) {
  const { match, sets, playersById } = useMatchLineups(matchId);
  if (!match) return <Message text={t.rotation.matchNotFound} />;
  const set = resolveSet(setParam, sets);
  if (!set) return <Message text={t.rotation.noSets} />;

  return (
    <>
      <Stack.Screen options={{ title: t.rotation.title(set.setNumber) }} />
      <SetPicker sets={setNumbersOf(sets)} selected={set.setNumber} onSelect={onSelectSet} />
      <RotationPanel key={set.setNumber} set={set} playersById={playersById} />
    </>
  );
}

export function Message({ text }: { text: string }) {
  return (
    <Text style={styles.message} accessibilityRole="alert">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
