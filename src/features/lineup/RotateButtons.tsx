import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { formationRotation, rotateStarters } from '@/domain/roles';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import type { LineupDraft } from './useLineupDraft';

/**
 * "Rotate ↺ / ↻": moves the whole starting six and the formation one position before the set,
 * so the setter can start anywhere; between them the setter rotation ("Setter on 4"), which
 * follows the formation's setter spot (also on an empty court). Disabled for played sets.
 */
export function RotateButtons({ editor }: { editor: LineupDraft }) {
  const t = useT();
  const { set, locked, update } = editor;
  const s = t.lineup.rotate;
  const disabled = locked;
  const hint = locked ? t.live.lineupLocked : s.hint;
  const rotation = formationRotation(set.formation);

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
      <Text
        style={styles.setter}
        accessibilityLabel={s.setterOnLabel(rotation)}
        accessibilityLiveRegion="polite"
        testID="setter-rotation"
      >
        {s.setterOn(rotation)}
      </Text>
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
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  setter: { ...typography.label, color: colors.text, textAlign: 'center', flexShrink: 1 },
  grow: { flex: 1 },
});
