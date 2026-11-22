import { Pressable, Text } from 'react-native';

import { useT } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** The two views of live mode, in swipe order (v8: swipe left on Live → Performance). */
export const LIVE_VIEWS = ['live', 'performance'] as const;

export type LiveView = (typeof LIVE_VIEWS)[number];

/**
 * v6.1: header button (top right) that switches live mode between the court (scoring, subs) and
 * the performance overview. It lives in the header so the live screen keeps its height (the
 * court and Substitution must fit at 390×844, DECISIONS #75, #126, #164).
 */
export function LiveViewToggle({
  value,
  onChange,
}: {
  value: LiveView;
  onChange: (view: LiveView) => void;
}) {
  const styles = useStyles();
  const t = useT();
  const s = t.live.viewTabs;
  const target: LiveView = value === 'live' ? 'performance' : 'live';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={target === 'performance' ? s.performanceLabel : s.liveLabel}
      onPress={() => onChange(target)}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID={`live-view-${target}`}
    >
      <Text style={styles.label} numberOfLines={1}>
        {target === 'performance' ? s.performance : s.live}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  button: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  pressed: { opacity: 0.7 },
  label: { ...typography.body, color: theme.colors.text },
}));
