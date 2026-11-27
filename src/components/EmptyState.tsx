import { Text, View } from 'react-native';

import { borderWidth, makeStyles, radius, spacing, typography } from '@/theme';

/** Size of the small court drawing (px). */
const COURT_WIDTH = 72;
const COURT_HEIGHT = 56;
/** Widest line of text, so the sentence stays a short centred block. */
const TEXT_MAX_WIDTH = 280;

/**
 * v11: an empty list — a small court drawing and the list's own "nothing here yet" sentence. It
 * has no button of its own: the screen's add button stays the one action.
 */
export function EmptyState({ children, testID }: { children: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.court} accessibilityElementsHidden importantForAccessibility="no">
        <View style={styles.net} />
      </View>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  court: {
    width: COURT_WIDTH,
    height: COURT_HEIGHT,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  // The net: a line a third of the way down.
  net: {
    marginTop: Math.round(COURT_HEIGHT / 3),
    height: borderWidth.thin * 2,
    backgroundColor: theme.colors.border,
  },
  text: {
    ...typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    maxWidth: TEXT_MAX_WIDTH,
  },
}));
