import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing, touchTarget, useTheme } from '@/theme';

import type { IconName } from './Button';

export interface IconButtonProps {
  icon: IconName;
  /** What the button does (there is no visible text). */
  accessibilityLabel: string;
  onPress: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
  /** `round`: on a round `surface` mark (previous / next); default: the bare icon. */
  shape?: 'plain' | 'round';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ICON_SIZE = 22;

/**
 * v11: a 44 × 44 button that shows only an icon — the quiet actions of a row (edit, delete,
 * rename, copy) and round arrow buttons. The accessible name carries what it does.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  accessibilityHint,
  disabled = false,
  shape = 'plain',
  style,
  testID,
}: IconButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={shape === 'round' ? styles.round : null}>
        <Ionicons
          name={icon}
          size={ICON_SIZE}
          color={shape === 'round' ? colors.text : colors.textMuted}
        />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  button: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
    width: touchTarget - spacing.xs,
    height: touchTarget - spacing.xs,
    borderRadius: radius.round,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));
