import { Text, View } from 'react-native';

import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

export interface DetailLineProps {
  label: string;
  value: string;
  /** How the number is computed (shown under the line). */
  hint?: string;
  testID?: string;
}

/** "Error rate ……… 12% (2 errors in 17 rallies)" with an optional explanation. */
export function DetailLine({ label, value, hint, testID }: DetailLineProps) {
  const styles = useStyles();
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

const useStyles = makeStyles((theme) => ({
  wrap: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  label: { ...typography.body, color: theme.colors.textMuted },
  value: { ...typography.body, fontWeight: '600', color: theme.colors.text, flexShrink: 1 },
  hint: { ...typography.caption, color: theme.colors.textMuted },
}));
