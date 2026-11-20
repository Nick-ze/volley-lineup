import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { decorativeSwitchProps } from '@/lib/switchProps';
import { colors, spacing, touchTarget, typography } from '@/theme';

export interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

/** A labelled on/off switch. The whole row is the (≥ 44 px) control; the Switch is only visual. */
export function ToggleRow({ label, value, onChange, testID }: ToggleRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      // aria-* (not accessibilityState) so react-native-web also exposes the state.
      aria-checked={value}
      onPress={() => onChange(!value)}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch
          value={value}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.text}
          {...decorativeSwitchProps}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pressed: { opacity: 0.8 },
  label: { ...typography.body, color: colors.text, flex: 1 },
});
