import { StyleSheet, Text, useWindowDimensions } from 'react-native';

import { colors, touchTarget, typography } from '@/theme';

/** Room the header keeps for the back button and its margins beside the title. */
export const HEADER_SIDE_ROOM = touchTarget * 3;

/**
 * Header title on one line: long titles (e.g. "vs <long opponent>") end in "…" instead of
 * running past the screen edge. The header's title container doesn't shrink on the web, so the
 * title limits its own width to the window minus the room for the back button.
 */
export function HeaderTitle({ children }: { children: string }) {
  const { width } = useWindowDimensions();
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      style={[styles.title, { maxWidth: Math.max(touchTarget, width - HEADER_SIDE_ROOM) }]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.subheading, color: colors.text },
});
