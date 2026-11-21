import { StyleSheet } from 'react-native';

import { listStyles } from '@/features/roster/components/styles';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

/** Row height and width of a numeric column. */
const ROW_HEIGHT = spacing.xxl;
const CELL_WIDTH = touchTarget;

/** Styles shared by `StatsTable` and its scrolling `StatsNumbers` part. */
export const statsTableStyles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  heading: listStyles.title,
  // As wide as its columns, but never wider than the screen (then the numbers scroll).
  table: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  scroller: { flexGrow: 0, flexShrink: 1 },
  row: { flexDirection: 'row' },
  cell: {
    ...typography.body,
    color: colors.text,
    height: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headCell: { paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceRaised },
  header: { ...typography.label, color: colors.textMuted, lineHeight: ROW_HEIGHT },
  num: { width: CELL_WIDTH, textAlign: 'center' },
  legend: { ...typography.caption, color: colors.textMuted },
});
