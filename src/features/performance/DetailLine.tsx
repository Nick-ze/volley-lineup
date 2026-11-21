import { StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

export interface DetailLineProps {
  label: string;
  value: string;
  /** How the number is computed (shown under the line). */
  hint?: string;
  testID?: string;
}

/** "Error rate ……… 12% (2 errors in 17 rallies)" with an optional explanation. */
export function DetailLine({ label, value, hint, testID }: DetailLineProps) {
  const t = useT();
  return (
    <View style={styles.wrap}>
      <View
        style={styles.row}
        accessible
        accessibilityLabel={t.performance.lineLabel(label, value)}
        testID={testID}
      >
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  label: { ...typography.body, color: colors.textMuted },
  value: { ...typography.body, fontWeight: '600', color: colors.text, flexShrink: 1 },
  hint: { ...typography.caption, color: colors.textMuted },
});
