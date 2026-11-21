import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { DescriptionLockBar } from './DescriptionLockBar';
import { useDescriptionLock } from './descriptionLock';

/** Side of the drawn check box. */
const BOX_SIZE = 22;

/**
 * Settings → Export: "Include descriptions" (DECISIONS #150). Off by default, only enabled
 * while descriptions are unlocked; locking turns it off again (`descriptionLock.ts`).
 */
export function IncludeDescriptionsToggle() {
  const t = useT();
  const s = t.transfer.export;
  const unlocked = useDescriptionLock((x) => x.unlocked);
  const checked = useDescriptionLock((x) => x.includeInExport);
  const setChecked = useDescriptionLock((x) => x.setIncludeInExport);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={s.includeDescriptions}
        accessibilityHint={unlocked ? undefined : s.includeDescriptionsLocked}
        accessibilityState={{ checked, disabled: !unlocked }}
        aria-checked={checked}
        aria-disabled={!unlocked}
        disabled={!unlocked}
        onPress={() => setChecked(!checked)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed, !unlocked && styles.off]}
        testID="export-include-descriptions"
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <Text style={styles.tick}>{s.checkMark}</Text> : null}
        </View>
        <Text style={styles.label}>{s.includeDescriptions}</Text>
      </Pressable>
      <Text style={styles.hint}>
        {unlocked ? s.includeDescriptionsHint : s.includeDescriptionsLocked}
      </Text>
      <DescriptionLockBar />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.8 },
  off: { opacity: 0.4 },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { ...typography.label, color: colors.onPrimary },
  label: { ...typography.body, color: colors.text, flex: 1 },
  hint: { ...typography.caption, color: colors.textMuted },
});
