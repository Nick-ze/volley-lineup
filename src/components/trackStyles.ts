import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/**
 * v11: one look for every "choose one of these" row (set tabs, formation, serve, rotation 1–6,
 * language, theme): a track with segments. The selected segment is soft orange (`choice`) or, for
 * sets, the yellow that marks what is current (`set`). On a panel the track is a darker well.
 */
export const useTrackStyles = makeStyles((theme) => ({
  track: {
    flexDirection: 'row',
    gap: spacing.xxs,
    padding: spacing.xxs,
    borderRadius: radius.md,
    backgroundColor: theme.colors.surface,
  },
  trackOnPanel: { backgroundColor: theme.colors.background },
  segment: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  choice: { backgroundColor: theme.colors.primarySoft },
  set: { backgroundColor: theme.colors.highlight },
  /** The selected segment of a control that can't be changed right now. */
  locked: { backgroundColor: theme.colors.surfaceRaised },
  text: { ...typography.label, color: theme.colors.text, textAlign: 'center' },
  textMuted: { color: theme.colors.textMuted },
  choiceText: { color: theme.colors.primaryText },
  setText: { color: theme.colors.onHighlight },
  pressed: { opacity: 0.8 },
}));
