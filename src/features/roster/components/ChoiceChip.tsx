import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme';

export interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  /** 'checkbox' for multi-select, 'radio' for single choice, 'tab' for tabs. */
  role?: 'checkbox' | 'radio' | 'tab';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A pill-shaped toggle used for positions, home/away and tabs. */
export function ChoiceChip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  role = 'checkbox',
  style,
  testID,
}: ChoiceChipProps) {
  const state = role === 'tab' ? { selected } : { checked: selected };
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={state}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  label: { ...typography.label, color: colors.text },
  labelSelected: { color: colors.onPrimary },
});
