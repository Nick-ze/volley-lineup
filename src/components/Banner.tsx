import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, radius, spacing, typography } from '@/theme';

export interface BannerProps {
  /** The notice. */
  children: string;
  /** Beside the text (e.g. a button that resolves it). */
  action?: ReactNode;
  /** Announce it to screen readers when it appears (a warning). */
  alert?: boolean;
  testID?: string;
}

/**
 * v11: a notice on a soft yellow field (PLAN §46.2: yellow marks what is current and what needs
 * a look), e.g. "This set has been played …". Text only — no icon or emoji (DECISIONS #343).
 */
export function Banner({ children, action, alert = false, testID }: BannerProps) {
  const styles = useStyles();
  return (
    <View style={styles.box} testID={testID}>
      <Text
        style={styles.text}
        accessibilityRole={alert ? 'alert' : undefined}
        accessibilityLiveRegion={alert ? 'polite' : undefined}
      >
        {children}
      </Text>
      {action}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  box: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: theme.colors.highlightSoft,
  },
  text: { ...typography.label, color: theme.colors.highlightText, flexShrink: 1 },
}));
