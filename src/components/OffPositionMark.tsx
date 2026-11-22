import { Text } from 'react-native';

import { makeStyles, radius, spacing, typography } from '@/theme';

export interface OffPositionMarkProps {
  testID?: string;
}

/**
 * The "*" at the top right of a court spot whose player plays a role that is none of their
 * positions (v4, DECISIONS #115). Place it inside the spot's container (`position: 'relative'`,
 * the default in React Native). Purely visual — the spot's accessibility label says it in words.
 */
export function OffPositionMark({ testID }: OffPositionMarkProps) {
  const styles = useStyles();
  return (
    <Text
      style={styles.mark}
      accessibilityElementsHidden
      importantForAccessibility="no"
      aria-hidden
      testID={testID}
    >
      *
    </Text>
  );
}

const useStyles = makeStyles((theme) => ({
  mark: {
    position: 'absolute',
    top: spacing.xxs,
    right: spacing.xs,
    ...typography.label,
    fontWeight: '800',
    color: theme.colors.highlight,
    // Dark backing so the mark reads on the court colour (like RoleTag).
    backgroundColor: theme.colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    overflow: 'hidden',
  },
}));
