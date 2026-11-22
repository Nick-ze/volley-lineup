import { Text, View } from 'react-native';

import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

/** What the rating and the abbreviations mean (DECISIONS #152). */
export function PerformanceLegend() {
  const styles = useStyles();
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

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  heading: { ...typography.label, color: theme.colors.text },
  text: { ...typography.caption, color: theme.colors.textMuted },
}));
