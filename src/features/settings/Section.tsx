import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, radius, spacing, typography } from '@/theme';

export interface SectionProps {
  title: string;
  hint?: string;
  children?: ReactNode;
  tone?: 'default' | 'danger';
}

/** A titled card on the settings screen. */
export function Section({ title, hint, children, tone = 'default' }: SectionProps) {
  const styles = useStyles();
  return (
    <View style={[styles.card, tone === 'danger' && styles.danger]}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  danger: { borderColor: theme.colors.error },
  title: { ...typography.subheading, color: theme.colors.text },
  hint: { ...typography.body, color: theme.colors.textMuted },
}));
