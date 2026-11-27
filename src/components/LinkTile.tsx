import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

import type { IconName } from './Button';
import { PRESS_SCALE } from './motion';

export interface LinkTileProps {
  /** Visible text under the icon. */
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Defaults to `label`; must start with it. */
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ICON_SIZE = 20;
/** Below this factor the label stops shrinking (phones; the web cuts it with "…"). */
const LABEL_MIN_SCALE = 0.8;

/**
 * v11: a small tile with an icon over a one-line label — the match screen's links to its other
 * views (rotation, starters, stats, performance). A row of them takes one line where a row of
 * buttons took two.
 */
export function LinkTile({
  label,
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
  testID,
}: LinkTileProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.tile,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={ICON_SIZE}
        color={colors.textMuted}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text
        style={styles.label}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={LABEL_MIN_SCALE}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  tile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: touchTarget,
    minHeight: touchTarget + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.md,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.8, transform: [{ scale: PRESS_SCALE }] },
  disabled: { opacity: 0.4 },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    maxWidth: '100%',
  },
}));
