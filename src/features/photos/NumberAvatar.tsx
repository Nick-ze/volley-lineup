import { Text, View } from 'react-native';

import { inlineFontSize, makeStyles, radius, touchTarget, typography, useTheme } from '@/theme';

/** A player's picture fallback: the jersey number in a round badge (greyed when inactive). */
export function NumberAvatar({
  number,
  size = touchTarget,
  inactive = false,
  large = false,
}: {
  /** The number as shown (may be empty in a new player's form). */
  number: number | string;
  size?: number;
  inactive?: boolean;
  /** v8, roster cards: the number scales with the circle. */
  large?: boolean;
}) {
  const styles = useStyles();
  const { fonts } = useTheme();
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        inactive && styles.inactive,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[
          styles.text,
          large && inlineFontSize(Math.round(size * 0.4), fonts),
          inactive && styles.textInactive,
        ]}
      >
        {number}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  circle: {
    borderRadius: radius.round,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { backgroundColor: theme.colors.surfaceRaised },
  text: {
    ...typography.subheading,
    fontWeight: typography.jersey.fontWeight,
    color: theme.colors.onPrimary,
  },
  textInactive: { color: theme.colors.textMuted },
}));
