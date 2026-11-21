import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OffPositionMark, RoleTag } from '@/components';
import type { Position } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme';

import { BADGE_OVERLAP, ROLE_ROW_HEIGHT } from './layout';

export interface RoleRowProps {
  role: Position | null;
  /** The role is none of the player's positions: "*" at the top right of the spot. */
  offPosition?: boolean;
  testID: string;
}

/**
 * The row at the top of a court spot with the role the player plays ("S", "OPP", "L"), plus the
 * "*" in the spot's top-right corner for an off-position role (`<testID>-off`). Always takes its
 * height so the chips of one court row line up. Shared by the rotation and live courts.
 */
export function RoleRow({ role, offPosition = false, testID }: RoleRowProps) {
  return (
    <>
      {role && offPosition ? <OffPositionMark testID={`${testID}-off`} /> : null}
      <View style={styles.roleRow}>{role ? <RoleTag role={role} testID={testID} /> : null}</View>
    </>
  );
}

export interface ChipWithBadgeProps {
  /** The chip (circle diameter `chipSize`). */
  children: ReactNode;
  chipSize: number;
  /** "Server" / "Serving" (yellow) or "L for #n" (white); nothing when null. */
  text: string | null;
  kind: 'server' | 'libero';
  testID?: string;
}

/**
 * A chip with its badge (who serves, or whom the libero stands in for) laid over the lower edge
 * of the circle, so the spot doesn't grow. The badge is purely visual (the label says it).
 */
export function ChipWithBadge({ children, chipSize, text, kind, testID }: ChipWithBadgeProps) {
  return (
    <View style={styles.wrap}>
      {children}
      {text ? (
        <View style={[styles.badgeWrap, { top: chipSize - BADGE_OVERLAP }]} pointerEvents="none">
          <Text
            style={[styles.badge, kind === 'libero' && styles.libero]}
            numberOfLines={1}
            importantForAccessibility="no"
            accessibilityElementsHidden
            testID={testID}
          >
            {text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  roleRow: { minHeight: ROLE_ROW_HEIGHT, justifyContent: 'center', marginBottom: spacing.xxs },
  wrap: { alignItems: 'center' },
  // Wider than the chip so "L for #15" / "Aufschläger" stay on one line, centred on the chip.
  badgeWrap: {
    position: 'absolute',
    left: -spacing.xl,
    right: -spacing.xl,
    alignItems: 'center',
  },
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
