import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, touchTarget, typography } from '@/theme';

/** A player's picture fallback: the jersey number in a round badge (greyed when inactive). */
export function NumberAvatar({
  number,
  size = touchTarget,
  inactive = false,
}: {
  /** The number as shown (may be empty in a new player's form). */
  number: number | string;
  size?: number;
  inactive?: boolean;
}) {
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
      <Text style={[styles.text, inactive && styles.textInactive]}>{number}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { backgroundColor: colors.surfaceRaised },
  text: {
    ...typography.subheading,
    fontWeight: typography.jersey.fontWeight,
    color: colors.onPrimary,
  },
  textInactive: { color: colors.textMuted },
});
