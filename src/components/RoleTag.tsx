import { StyleSheet, Text, View } from 'react-native';

import type { Position } from '@/domain/types';
import { colors, radius, spacing, typography } from '@/theme';

export interface RoleTagProps {
  role: Position;
  /** The role is none of the player's positions: shows "*" (v4.0, DECISIONS #114). */
  offPosition?: boolean;
  testID?: string;
}

/**
 * The role a starter plays (e.g. "S", "OPP"), shown at the top of a court spot; "*" marks a
 * role that isn't one of the player's positions. Purely visual — the spot's accessibility label
 * must say the role (and "not their position") in words.
 */
export function RoleTag({ role, offPosition = false, testID }: RoleTagProps) {
  return (
    <View
      style={styles.tag}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Text style={styles.text}>{role}</Text>
      {offPosition ? (
        <Text style={styles.mark} testID={testID ? `${testID}-off` : undefined}>
          *
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  text: { ...typography.caption, fontWeight: '700', color: colors.text },
  mark: { ...typography.label, fontWeight: '800', color: colors.highlight, marginLeft: 1 },
});
