import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
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

import { PRESS_SCALE } from './motion';

/**
 * v11 (PLAN §46): `primary` is the one main action of a screen (solid orange); `secondary` is
 * quiet (tone, no outline); `danger` keeps its outline; `dangerQuiet` is plain red text for a
 * destructive action that stands beside a harmless one (e.g. Reset beside Undo).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerQuiet';

export type IconName = ComponentProps<typeof Ionicons>['name'];

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
  /** v11: a small mark before the label (decorative: the label is read). */
  icon?: IconName;
}

/** Size of a button's icon (px). */
const ICON_SIZE = 18;

interface VariantColors {
  bg: string;
  pressedBg: string;
  fg: string;
  border: string;
}

const variantColors = (colors: ThemeColors): Record<ButtonVariant, VariantColors> => {
  const none = colors.transparent;
  return {
    primary: {
      bg: colors.primary,
      pressedBg: colors.primaryPressed,
      fg: colors.onPrimary,
      border: none,
    },
    secondary: {
      bg: colors.surfaceRaised,
      pressedBg: colors.surfaceRaised,
      fg: colors.text,
      border: none,
    },
    ghost: { bg: none, pressedBg: none, fg: colors.secondaryText, border: none },
    danger: { bg: none, pressedBg: none, fg: colors.error, border: colors.error },
    dangerQuiet: { bg: none, pressedBg: none, fg: colors.error, border: none },
  };
};

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
  icon,
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
        { backgroundColor: pressed ? v.pressedBg : v.bg, borderColor: v.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={ICON_SIZE}
          color={v.fg}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  base: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.8, transform: [{ scale: PRESS_SCALE }] },
  disabled: { opacity: 0.4 },
  // Centred also when a narrow button wraps its label onto two lines.
  label: {
    ...typography.label,
    fontSize: typography.body.fontSize,
    textAlign: 'center',
    flexShrink: 1,
  },
}));
