import { StyleSheet, View } from 'react-native';

import { Button } from '@/components';
import { rotateStarters } from '@/domain/roles';
import { COURT_POSITIONS } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import type { LineupDraft } from './useLineupDraft';

/**
 * "Rotate ↺ / ↻": moves the whole starting six one position before the set, so the setter can
 * start anywhere. Disabled for played sets and an empty court.
 */
export function RotateButtons({ editor }: { editor: LineupDraft }) {
  const t = useT();
  const { set, locked, update } = editor;
  const s = t.lineup.rotate;
  const empty = COURT_POSITIONS.every((p) => set.slots[p] === null);
  const disabled = locked || empty;
  const hint = locked ? t.live.lineupLocked : empty ? s.emptyHint : s.hint;

  return (
    <View style={styles.row}>
      <Button
        label={s.counterclockwise}
        accessibilityLabel={s.counterclockwiseLabel}
        accessibilityHint={hint}
        variant="secondary"
        compact
        disabled={disabled}
        onPress={() => update(rotateStarters(set, 'counterclockwise'))}
        testID="rotate-counterclockwise"
        style={styles.grow}
      />
      <Button
        label={s.clockwise}
        accessibilityLabel={s.clockwiseLabel}
        accessibilityHint={hint}
        variant="secondary"
        compact
        disabled={disabled}
        onPress={() => update(rotateStarters(set, 'clockwise'))}
        testID="rotate-clockwise"
        style={styles.grow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
});
