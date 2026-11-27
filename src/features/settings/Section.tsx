import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, radius, spacing, typography } from '@/theme';

export interface SectionProps {
  title: string;
  hint?: string;
  children?: ReactNode;
  tone?: 'default' | 'danger';
}

/** A titled group on the settings screen (v11: a label above a flat panel). */
export function Section({ title, hint, children, tone = 'default' }: SectionProps) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text
        style={[styles.title, tone === 'danger' && styles.dangerTitle]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={styles.card}>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  section: { gap: spacing.sm },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  // v11: the heading is a small label above its panel.
  title: { ...typography.eyebrow, color: theme.colors.textMuted, paddingHorizontal: spacing.xs },
  dangerTitle: { color: theme.colors.error },
  hint: { ...typography.body, color: theme.colors.textMuted },
}));
