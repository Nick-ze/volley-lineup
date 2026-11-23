import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

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
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      // aria-* (not accessibilityState) so react-native-web also exposes the state.
      aria-selected={role === 'tab' ? selected : undefined}
      aria-checked={role === 'tab' ? undefined : selected}
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

const useStyles = makeStyles((theme) => ({
  chip: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pressed: { opacity: 0.8 },
  label: { ...typography.label, color: theme.colors.text },
  labelSelected: { color: theme.colors.onPrimary },
}));
