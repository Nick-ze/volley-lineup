import { StyleSheet } from 'react-native';

import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** Row height and width of a numeric column. */
const ROW_HEIGHT = spacing.xxl;
const CELL_WIDTH = touchTarget;

/** Styles shared by `StatsTable` and its scrolling `StatsNumbers` part. */
export const useStatsTableStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.sm },
  // Same as the roster list's title (`useListStyles().title`).
  heading: { ...typography.subheading, color: theme.colors.text },
  // As wide as its columns, but never wider than the screen (then the numbers scroll).
  table: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  scroller: { flexGrow: 0, flexShrink: 1 },
  row: { flexDirection: 'row' },
  cell: {
    ...typography.body,
    color: theme.colors.text,
    height: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headCell: { paddingHorizontal: spacing.sm, backgroundColor: theme.colors.surfaceRaised },
  header: { ...typography.label, color: theme.colors.textMuted, lineHeight: ROW_HEIGHT },
  num: { width: CELL_WIDTH, textAlign: 'center' },
  legend: { ...typography.caption, color: theme.colors.textMuted },
}));
