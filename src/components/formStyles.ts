import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** Below this width for the name area, a row's action buttons wrap onto a second line. */
const listRowMainMinWidth = 190;

/** Styles shared by the roster feature's forms and list rows. */
export const useFormStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  sectionLabel: { ...typography.label, color: theme.colors.textMuted },
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingRight: spacing.sm,
  },
  main: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: listRowMainMinWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + spacing.md,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
  },
  // v8 QA: a row with a picture (team list) keeps the same room for the name, so at phone widths
  // the actions wrap below instead of cutting the name short ("Volley …").
  mainWithLeading: { flexBasis: listRowMainMinWidth + touchTarget + spacing.md },
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
  pressed: { opacity: 0.8 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chevron: { ...typography.heading, color: theme.colors.textMuted, paddingHorizontal: spacing.xs },
}));
