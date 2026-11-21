import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import type { RotateDirection } from '@/domain/roles';
import type { RotationNumber } from '@/domain/rotation';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

export interface SetupRotateRowProps {
  /** Where the setter starts (`setterRotation` of the draft), or null without a setter. */
  setterAt: RotationNumber | null;
  /** Nobody on court yet: nothing to rotate. */
  disabled: boolean;
  onRotate: (direction: RotateDirection) => void;
}

/** "Setter at position n" + Rotate ↻ / ↺ in the next-set setup (v4, before the set starts). */
export function SetupRotateRow({ setterAt, disabled, onRotate }: SetupRotateRowProps) {
  const t = useT();
  const s = t.live.setup;
  return (
    <View style={styles.wrap}>
      {setterAt !== null ? (
        <Text style={styles.text} testID="setup-setter-at">
          {s.setterAt(setterAt)}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Button
          label={s.rotateCw}
          accessibilityLabel={s.rotateCwLabel}
          variant="secondary"
          compact
          disabled={disabled}
          style={styles.grow}
          onPress={() => onRotate('clockwise')}
          testID="setup-rotate-cw"
        />
        <Button
          label={s.rotateCcw}
          accessibilityLabel={s.rotateCcwLabel}
          variant="secondary"
          compact
          disabled={disabled}
          style={styles.grow}
          onPress={() => onRotate('counterclockwise')}
          testID="setup-rotate-ccw"
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
