import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

/** What the rating and the abbreviations mean (DECISIONS #152). */
export function PerformanceLegend() {
  const t = useT();
  return (
    <View style={styles.wrap} testID="perf-legend">
      <Text style={styles.heading} accessibilityRole="header">
        {t.performance.legendHeading}
      </Text>
      <Text style={styles.text}>{t.performance.legendRating}</Text>
      <Text style={styles.text}>{t.performance.legendActions}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  heading: { ...typography.label, color: colors.text },
  text: { ...typography.caption, color: colors.textMuted },
});
