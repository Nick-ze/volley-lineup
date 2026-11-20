import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, touchTarget, typography } from '@/theme';

/** Round avatar in the profile colour with the name's first letter. */
export function Avatar({
  name,
  color,
  size = touchTarget,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[styles.circle, { backgroundColor: color, width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.letter}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  // All profile colours are light/bright enough for near-black text (AA).
  letter: { ...typography.subheading, color: colors.onPrimary },
});
