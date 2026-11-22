import { StyleSheet, View } from 'react-native';

import { Button } from '@/components';
import type { Player, SetEvent } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { playerRef, tagDetail } from './format';
import { ResetLiveData } from './ResetLiveData';

export interface UndoActionsProps {
  /** The set's last event (undefined when nothing has happened yet). */
  last: SetEvent | undefined;
  /** With nothing to undo here: the previous won set whose last point Undo removes. */
  acrossSet?: number | null;
  playersById: Map<string, Player>;
  onUndo: () => void;
  onReset: () => void;
}

/** Undo (labelled with what it undoes, also across a set end) and "Reset live data". */
export function UndoActions({
  last,
  acrossSet = null,
  playersById,
  onUndo,
  onReset,
}: UndoActionsProps) {
  const t = useT();
  const ref = (id: string) => playerRef(t, playersById, id);
  const detail = last?.type === 'point' ? tagDetail(t, playersById, last) : null;
  const undoLabel = !last
    ? acrossSet !== null
      ? t.live.undoAcross(acrossSet)
      : t.live.undoNothing
    : last.type === 'point'
      ? detail
        ? t.tags.withDetail(t.live.undoPoint(last.winner === 'us'), detail)
        : t.live.undoPoint(last.winner === 'us')
      : t.live.undoSub(ref(last.outPlayerId), ref(last.inPlayerId));
  return (
    <View style={styles.row}>
      <Button
        label={t.live.undo}
        accessibilityLabel={undoLabel}
        variant="secondary"
        disabled={!last && acrossSet === null}
        onPress={onUndo}
        style={styles.undo}
        testID="undo"
      />
      <ResetLiveData disabled={!last} onReset={onReset} style={styles.reset} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  // Undo keeps its whole label ("Rückgängig", also with the wide dyslexia font); Reset takes
  // the rest and wraps onto two lines when it has to.
  undo: { flexGrow: 1, flexShrink: 0 },
  reset: { flexShrink: 1, minWidth: 0 },
});
