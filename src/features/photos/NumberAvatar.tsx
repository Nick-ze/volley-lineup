import { Text, View } from 'react-native';

import { inlineFontSize, makeStyles, touchTarget, typography, useTheme } from '@/theme';

/** Default size of a `large` number relative to the badge. */
const LARGE_SCALE = 0.4;

/**
 * A player's picture fallback: the jersey number in a round badge (greyed when inactive); v8.2:
 * or a square tile like the roster cards' full pictures.
 */
export function NumberAvatar({
  number,
  size = touchTarget,
  inactive = false,
  large = false,
  shape = 'circle',
  cornerRadius = 0,
  largeScale = LARGE_SCALE,
  card = false,
}: {
  /** The number as shown (may be empty in a new player's form). */
  number: number | string;
  size?: number;
  inactive?: boolean;
  /** v8, roster cards: the number scales with the circle. */
  large?: boolean;
  /** v8.2: `square` matches a square `Photo` (default `circle`). */
  shape?: 'circle' | 'square';
  /** Corner radius of a `square` tile. */
  cornerRadius?: number;
  /** With `large`: the number's size as a share of `size` (default 0.4). */
  largeScale?: number;
  /**
   * v11, roster cards: a dark tile with the number in the display typeface and in orange (solid
   * orange is kept for the court and the main action). Use with `large`.
   */
  card?: boolean;
}) {
  const styles = useStyles();
  const { fonts } = useTheme();
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : cornerRadius },
        card && styles.card,
        inactive && styles.inactive,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[
          styles.text,
          large && inlineFontSize(Math.round(size * largeScale), fonts, card),
          card && { fontFamily: fonts.displayHeavy },
          card && styles.cardText,
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
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: theme.colors.surfaceRaised },
  cardText: { color: theme.colors.primaryText, fontWeight: undefined },
  inactive: { backgroundColor: theme.colors.surfaceRaised },
  text: {
    ...typography.subheading,
    fontWeight: typography.jersey.fontWeight,
    color: theme.colors.onPrimary,
  },
  textInactive: { color: theme.colors.textMuted },
}));
