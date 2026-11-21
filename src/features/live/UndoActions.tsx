import { StyleSheet, View } from 'react-native';

import { Button } from '@/components';
import type { Player, SetEvent } from '@/domain/types';
import { t } from '@/i18n/en';
import { spacing } from '@/theme';

import { playerRef } from './format';
import { ResetLiveData } from './ResetLiveData';

export interface UndoActionsProps {
  /** The set's last event (undefined when nothing has happened yet). */
  last: SetEvent | undefined;
  playersById: Map<string, Player>;
  onUndo: () => void;
  onReset: () => void;
}

/** Undo (labelled with what it undoes) and "Reset live data". */
export function UndoActions({ last, playersById, onUndo, onReset }: UndoActionsProps) {
  const ref = (id: string) => playerRef(playersById, id);
  const undoLabel = !last
    ? t.live.undoNothing
    : last.type === 'point'
      ? t.live.undoPoint(last.winner === 'us')
      : t.live.undoSub(ref(last.outPlayerId), ref(last.inPlayerId));
  return (
    <View style={styles.row}>
      <Button
        label={t.live.undo}
        accessibilityLabel={undoLabel}
        variant="secondary"
        disabled={!last}
        onPress={onUndo}
        style={styles.grow}
        testID="undo"
      />
      <ResetLiveData disabled={!last} onReset={onReset} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
});
