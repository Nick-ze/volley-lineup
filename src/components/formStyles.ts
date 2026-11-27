import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/**
 * Below this width for the name area, a row's action buttons wrap onto a second line. The wide
 * dyslexia font needs more room for the name, so there the actions wrap sooner.
 */
const LIST_ROW_MAIN_MIN_WIDTH = 140;
const LIST_ROW_MAIN_MIN_WIDTH_WIDE_FONT = 230;

const mainMinWidth = (wideFont: boolean) =>
  wideFont ? LIST_ROW_MAIN_MIN_WIDTH_WIDE_FONT : LIST_ROW_MAIN_MIN_WIDTH;

/** Styles shared by the roster feature's forms and list rows. */
export const useFormStyles = makeStyles((theme) => ({
  card: {
    // v11: a panel is told apart by tone, not by an outline.
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  sectionLabel: { ...typography.label, color: theme.colors.textMuted },
  /** v11: a small capital label above a group or a list. */
  eyebrow: { ...typography.eyebrow, color: theme.colors.textMuted },
  hint: { ...typography.caption, color: theme.colors.textMuted },
  grow: { flex: 1 },
}));

export const useListStyles = makeStyles((theme) => ({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    // Narrow phones: actions (Rename, Delete…) wrap below the name instead of truncating it.
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    paddingRight: spacing.sm,
  },
  main: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: mainMinWidth(theme.dyslexiaFont),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + spacing.lg + spacing.xs,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
  },
  // v8 QA: a row with a picture (team list) keeps the same room for the name, so at phone widths
  // the actions wrap below instead of cutting the name short ("Volley …").
  mainWithLeading: { flexBasis: mainMinWidth(theme.dyslexiaFont) + touchTarget + spacing.md },
  text: { flex: 1, gap: spacing.xxs },
  title: { ...typography.subheading, color: theme.colors.text },
  subtitle: { ...typography.label, color: theme.colors.textMuted },
  empty: { ...typography.body, color: theme.colors.textMuted },
  heading: { ...typography.heading, color: theme.colors.text },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  /** v8.4: room between a team tab's header row (count + add button) and the list below it. */
  tabHeader: { marginBottom: spacing.md },
  pressed: { opacity: 0.8 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chevron: { ...typography.heading, color: theme.colors.textMuted, paddingHorizontal: spacing.xs },
}));
