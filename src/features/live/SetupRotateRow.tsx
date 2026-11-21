import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import type { RotateDirection } from '@/domain/roles';
import type { RotationNumber } from '@/domain/rotation';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

export interface SetupRotateRowProps {
  /** Where the setter spot starts (`formationRotation` of the draft's formation). */
  setterAt: RotationNumber;
  onRotate: (direction: RotateDirection) => void;
}

/** "Setter on n" + Rotate ↺ / ↻ (same order as the lineup builder) in the next-set setup (v4, before the set starts). */
export function SetupRotateRow({ setterAt, onRotate }: SetupRotateRowProps) {
  const t = useT();
  const s = t.live.setup;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text} testID="setup-setter-at">
        {s.setterAt(setterAt)}
      </Text>
      <View style={styles.row}>
        <Button
          label={s.rotateCcw}
          accessibilityLabel={s.rotateCcwLabel}
          variant="secondary"
          compact
          style={styles.grow}
          onPress={() => onRotate('counterclockwise')}
          testID="setup-rotate-ccw"
        />
        <Button
          label={s.rotateCw}
          accessibilityLabel={s.rotateCwLabel}
          variant="secondary"
          compact
          style={styles.grow}
          onPress={() => onRotate('clockwise')}
          testID="setup-rotate-cw"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  text: { ...typography.label, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1 },
});
