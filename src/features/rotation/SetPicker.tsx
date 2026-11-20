import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SetNumber } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

export interface SetPickerProps {
  sets: readonly SetNumber[];
  selected: SetNumber;
  onSelect: (set: SetNumber) => void;
}

/** Tabs for the sets that exist in the match. The selected set is yellow. */
export function SetPicker({ sets, selected, onSelect }: SetPickerProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel={t.rotation.setPickerLabel}
    >
      {sets.map((n) => {
        const active = n === selected;
        return (
          <Pressable
            key={n}
            accessibilityRole="tab"
            accessibilityLabel={t.rotation.setTabLabel(n)}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(n)}
            testID={`set-tab-${n}`}
            style={({ pressed }) => [
              styles.tab,
              active && styles.active,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{t.rotation.setTab(n)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tab: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  pressed: { opacity: 0.8 },
  label: { ...typography.label, color: colors.text },
  activeLabel: { color: colors.onHighlight },
});
