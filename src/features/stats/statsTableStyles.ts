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
    // v11: a flat panel without an outline.
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  scroller: { flexGrow: 0, flexShrink: 1 },
  row: { flexDirection: 'row' },
  cell: {
    ...typography.body,
    color: theme.colors.text,
    height: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT,
    // The typeface's digits line up in their columns.
    fontVariant: ['tabular-nums'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headCell: { paddingHorizontal: spacing.sm },
  header: { ...typography.eyebrow, color: theme.colors.textMuted, lineHeight: ROW_HEIGHT },
  // v8: the wide dyslexia font needs wider columns ("100%").
  num: { width: theme.dyslexiaFont ? CELL_WIDTH * 1.3 : CELL_WIDTH, textAlign: 'center' },
  legend: { ...typography.caption, color: theme.colors.textMuted },
}));
