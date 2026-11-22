import { StyleSheet } from 'react-native';

import { colors, spacing, touchTarget, typography } from '@/theme';

/** Chip rows the opponent list shows before it scrolls inside the form (a half row hints at more). */
const visibleChipRows = 3.5;

/** Styles of the new-match form's season and opponent pickers. */
export const chipStyles = StyleSheet.create({
  group: { gap: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  scroll: { maxHeight: visibleChipRows * touchTarget + Math.floor(visibleChipRows) * spacing.sm },
  value: { ...typography.body, color: colors.text },
  error: { ...typography.label, color: colors.error },
});
