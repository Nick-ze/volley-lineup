import { StyleSheet } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme';

/** Styles shared by the roster feature's forms and list rows. */
export const formStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  sectionLabel: { ...typography.label, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted },
  grow: { flex: 1 },
});

export const listStyles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: spacing.sm,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + spacing.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
  },
  text: { flex: 1, gap: spacing.xxs },
  title: { ...typography.subheading, color: colors.text },
  subtitle: { ...typography.label, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted },
  heading: { ...typography.heading, color: colors.text },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pressed: { opacity: 0.8 },
  chevron: { ...typography.heading, color: colors.textMuted, paddingHorizontal: spacing.xs },
});
