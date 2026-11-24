import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useT } from '@/i18n';
import { borderWidth, fontSize, inlineFontSize, makeStyles, useTheme } from '@/theme';

/** The badge's diameter as a share of the player chip's diameter (v9.1). */
const CHIP_SHARE = 0.34;
/** Never smaller than this (px), so the letter keeps at least the caption size. */
export const CAPTAIN_BADGE_MIN_SIZE = 18;
/** The letter's size as a share of the badge's diameter. */
const LETTER_SHARE = 0.6;
/**
 * Where the badge's centre sits on a round chip, as a share of the chip's diameter from its left
 * and top edges: on the ring at the top right (≈ 45°), so it overlaps the ring a little.
 */
const CHIP_CENTRE_X = 0.85;
const CHIP_CENTRE_Y = 0.15;

/** The captain badge's diameter for a player chip of `chipDiameter` px. */
export function captainBadgeSize(chipDiameter: number): number {
  return Math.max(CAPTAIN_BADGE_MIN_SIZE, Math.round(chipDiameter * CHIP_SHARE));
}

/** Absolute position of the badge at the top right of a round chip of `chipDiameter` px. */
export function captainBadgeOnChip(chipDiameter: number): ViewStyle {
  const size = captainBadgeSize(chipDiameter);
  return {
    position: 'absolute',
    left: Math.round(chipDiameter * CHIP_CENTRE_X - size / 2),
    top: Math.round(chipDiameter * CHIP_CENTRE_Y - size / 2),
  };
}

export interface CaptainBadgeProps {
  /** Diameter in px. */
  size: number;
  /** Placement (e.g. `captainBadgeOnChip(d)`, or absolute in a card's corner). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * v9.1: the team captain's mark — a small yellow circle with a "C", at the top right of a player.
 * The letter is near-black (`onHighlight`): white on the yellow fails contrast. Purely visual: the
 * player's accessibility label says "captain" in words.
 */
export function CaptainBadge({ size, style, testID }: CaptainBadgeProps) {
  const styles = useStyles();
  const t = useT();
  const { fonts } = useTheme();
  const letter = Math.max(fontSize.xs, Math.round(size * LETTER_SHARE));
  return (
    <View
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      pointerEvents="none"
      testID={testID}
    >
      <Text style={[styles.letter, inlineFontSize(letter, fonts)]}>{t.player.captainLetter}</Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  badge: {
    backgroundColor: theme.colors.highlight,
    // A dark edge keeps the yellow circle visible on white (light mode) and on a yellow ring.
    borderWidth: borderWidth.thin,
    borderColor: theme.colors.onHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: theme.colors.onHighlight,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
}));
