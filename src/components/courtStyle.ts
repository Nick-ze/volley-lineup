import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing, typography } from '@/theme';

const PADDING_KEYS = [
  'padding',
  'paddingVertical',
  'paddingHorizontal',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
] as const;

/** A slot's style split into its box and its padding (which goes to the sliding content box). */
export function splitPadding(style: ViewStyle): { box: ViewStyle; padding: ViewStyle } {
  const box: Record<string, unknown> = { ...style };
  const padding: Record<string, unknown> = {};
  for (const key of PADDING_KEYS) {
    if (style[key] !== undefined) {
      padding[key] = style[key];
      delete box[key];
    }
  }
  return { box, padding };
}

/** One flat style object (StyleSheet.flatten of nothing is empty). */
export const flat = (style: StyleProp<ViewStyle>): ViewStyle => StyleSheet.flatten(style) ?? {};

/** The court's styles (shared by `Court` and its `CourtSlot`s). */
export const useCourtStyles = makeStyles((theme) => ({
  // v8: the sliding content box inside a slot (it takes the slot's padding and alignment).
  content: { flexGrow: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  // The sliding copy keeps the slot's size and border width, without its fill and outline.
  ghostBox: { backgroundColor: theme.colors.transparent, borderColor: theme.colors.transparent },
  court: {
    backgroundColor: theme.colors.primary,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: theme.colors.courtLine,
    padding: spacing.sm,
    paddingTop: 0,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  grid: { gap: spacing.sm },
  net: {
    height: 18,
    borderBottomWidth: 4,
    borderBottomColor: theme.colors.net,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: -spacing.sm,
  },
  netLabel: { ...typography.caption, color: theme.colors.onCourt, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  attackLine: { height: 2, backgroundColor: theme.colors.courtLine, opacity: 0.8 },
  slot: {
    flex: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  posNumber: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.sm,
    ...typography.label,
    color: theme.colors.onCourt,
  },
}));
