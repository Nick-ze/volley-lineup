import { StyleSheet, Text, View } from 'react-native';

import type { Position } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme';

export interface RoleTagProps {
  role: Position;
  /**
   * @deprecated Ignored: the "*" for an off-position role is drawn by `OffPositionMark` at the
   * top right of the court spot. Kept optional so existing callers still compile.
   */
  offPosition?: boolean;
  testID?: string;
}

/**
 * The role a starter plays (e.g. "S", "OPP"), shown at the top of a court spot. Purely visual —
 * the spot's accessibility label must say the role (and "not their position") in words. An
 * off-position role is marked separately with `OffPositionMark`.
 */
export function RoleTag({ role, testID }: RoleTagProps) {
  return (
    <View
      style={styles.tag}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Text style={styles.text}>{role}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  text: { ...typography.caption, fontWeight: '700', color: colors.text },
});
