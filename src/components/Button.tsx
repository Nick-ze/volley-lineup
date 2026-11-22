import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import {
  makeStyles,
  radius,
  spacing,
  touchTarget,
  typography,
  useTheme,
  type ThemeColors,
} from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

const variantColors = (
  colors: ThemeColors,
): Record<ButtonVariant, { bg: string; fg: string; border: string }> => ({
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  ghost: { bg: colors.transparent, fg: colors.secondaryText, border: colors.transparent },
  danger: { bg: colors.transparent, fg: colors.error, border: colors.error },
});

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  compact = false,
}: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const v = variantColors(colors)[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  base: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { paddingHorizontal: spacing.md },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: { ...typography.label, fontSize: typography.body.fontSize },
}));
