import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export interface SectionProps {
  title: string;
  hint?: string;
  children?: ReactNode;
  tone?: 'default' | 'danger';
}

/** A titled card on the settings screen. */
export function Section({ title, hint, children, tone = 'default' }: SectionProps) {
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  danger: { borderColor: colors.error },
  title: { ...typography.subheading, color: colors.text },
  hint: { ...typography.body, color: colors.textMuted },
});
