import { Text, View } from 'react-native';

import type { ValidationIssue, ValidationResult } from '@/domain/lineupValidation';
import { useT, type Strings } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

function issueText<C extends string>(
  t: Strings,
  issue: ValidationIssue<C>,
  messages: Record<C, string>,
) {
  const where = issue.positions?.length ? ` (${t.lineup.issuePositions(issue.positions)})` : '';
  return `${messages[issue.code]}${where}`;
}

/** Errors (red) and warnings (yellow) for the current set. Warnings never block. */
export function ValidationPanel({ result }: { result: ValidationResult }) {
  const styles = useStyles();
  const t = useT();
  const { errors, warnings } = result;
  return (
    <View style={styles.box} testID="validation-panel" accessibilityLiveRegion="polite">
      <Text style={styles.title} accessibilityRole="header">
        {t.lineup.validationTitle}
      </Text>
      {errors.length === 0 && warnings.length === 0 ? (
        <Text style={styles.ok}>{t.lineup.validationOk}</Text>
      ) : null}
      {errors.map((e, i) => (
        <Text key={`e${i}`} style={styles.error} testID={`validation-error-${e.code}`}>
          {t.lineup.errorPrefix}
          {issueText(t, e, t.lineup.errors)}
        </Text>
      ))}
      {warnings.map((w, i) => (
        <Text key={`w${i}`} style={styles.warning} testID={`validation-warning-${w.code}`}>
          {t.lineup.warningPrefix}
          {issueText(t, w, t.lineup.warnings)}
        </Text>
      ))}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  box: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: { ...typography.label, color: theme.colors.text },
  ok: { ...typography.body, color: theme.colors.textMuted },
  error: { ...typography.body, color: theme.colors.error },
  warning: { ...typography.body, color: theme.colors.highlightText },
}));
