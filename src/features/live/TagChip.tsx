import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme';

export interface TagChipProps {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  /** A suggestion (e.g. the server for an ace): yellow outline. */
  highlighted?: boolean;
  onPress: () => void;
  testID?: string;
}

/** A compact pill (≥ 44 px tall) in the point-tag row. */
export function TagChip({
  label,
  accessibilityLabel,
  selected = false,
  highlighted = false,
  onPress,
  testID,
}: TagChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      // react-native-web ignores accessibilityState.
      aria-pressed={selected}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        highlighted && styles.highlighted,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]} numberOfLines={1}>
        {label}
      </Text>
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
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlighted: { borderColor: colors.highlight, borderWidth: 2 },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  label: { ...typography.body, fontWeight: '600', color: colors.text },
  selectedLabel: { color: colors.onPrimary },
});
