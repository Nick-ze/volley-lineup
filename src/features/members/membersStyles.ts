import { makeStyles, radius, spacing, typography } from '@/theme';

/** Below this width for the name / code, a row's buttons wrap onto a second line. */
const rowMainMinWidth = 160;

/** v10: styles shared by the members and join screens. */
export const useMembersStyles = makeStyles((theme) => ({
  section: { gap: spacing.sm },
  heading: { ...typography.heading, color: theme.colors.text },
  teamName: { ...typography.subheading, color: theme.colors.text },
  text: { ...typography.body, color: theme.colors.text },
  muted: { ...typography.body, color: theme.colors.textMuted },
  error: { ...typography.body, color: theme.colors.error },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  // Narrow phones: the buttons wrap below the name instead of squeezing it.
  rowMain: { flexGrow: 1, flexShrink: 1, flexBasis: rowMainMinWidth, gap: spacing.xxs },
  rowTitle: { ...typography.subheading, color: theme.colors.text },
  rowDetail: { ...typography.label, color: theme.colors.textMuted },
  code: { ...typography.subheading, color: theme.colors.text, letterSpacing: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
