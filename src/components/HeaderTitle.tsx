import type { ReactNode } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { makeStyles, spacing, touchTarget, typography } from '@/theme';

/** Room the header keeps for the back button and its margins beside the title. */
export const HEADER_SIDE_ROOM = touchTarget * 3;

/**
 * Header title on one line: long titles (e.g. "vs <long opponent>") end in "…" instead of
 * running past the screen edge. The header's title container doesn't shrink on the web, so the
 * title limits its own width to the window minus the room for the back button.
 */
export function HeaderTitle({ children, leading }: { children: string; leading?: ReactNode }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const maxWidth = Math.max(touchTarget, width - HEADER_SIDE_ROOM);
  const title = (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      style={[styles.title, leading ? styles.shrink : { maxWidth }]}
    >
      {children}
    </Text>
  );
  if (!leading) return title;
  // v8: e.g. the team picture before the team name; the name shrinks, the picture doesn't.
  return (
    <View style={[styles.row, { maxWidth }]}>
      {leading}
      {title}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  title: { ...typography.subheading, color: theme.colors.text },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
}));
