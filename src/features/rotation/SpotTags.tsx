import { StyleSheet, Text, View } from 'react-native';

import { RoleTag } from '@/components';
import type { Position } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme';

import { BADGE_ROW_HEIGHT, ROLE_ROW_HEIGHT } from './layout';

export interface RoleRowProps {
  role: Position | null;
  offPosition?: boolean;
  testID?: string;
}

/**
 * The row at the top of a court spot with the role the player plays ("S", "OPP*", "L"). Always
 * takes its height so the chips of one court row line up. Shared by the rotation and live courts.
 */
export function RoleRow({ role, offPosition = false, testID }: RoleRowProps) {
  return (
    <View style={styles.roleRow}>
      {role ? <RoleTag role={role} offPosition={offPosition} testID={testID} /> : null}
    </View>
  );
}

export interface SpotBadgeProps {
  /** "Server" / "Serving" (yellow) or "L for #n" (white); nothing when null. */
  text: string | null;
  kind: 'server' | 'libero';
  testID?: string;
}

/** The row below a chip: who serves, or whom the libero stands in for (purely visual). */
export function SpotBadge({ text, kind, testID }: SpotBadgeProps) {
  return (
    <View style={styles.badgeRow}>
      {text ? (
        <Text
          style={[styles.badge, kind === 'libero' && styles.libero]}
          numberOfLines={1}
          importantForAccessibility="no"
          accessibilityElementsHidden
          testID={testID}
        >
          {text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  roleRow: { minHeight: ROLE_ROW_HEIGHT, justifyContent: 'center', marginBottom: spacing.xxs },
  badgeRow: { minHeight: BADGE_ROW_HEIGHT, justifyContent: 'center', marginTop: spacing.xxs },
  badge: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.onHighlight,
    backgroundColor: colors.highlight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    overflow: 'hidden',
  },
  // Near-black on white, as before (white directly on the orange court fails AA).
  libero: { color: colors.onPrimary, backgroundColor: colors.text },
});
