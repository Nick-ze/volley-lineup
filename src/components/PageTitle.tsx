import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, spacing, touchTarget, typography } from '@/theme';

/** Below this factor the title stops shrinking and ends in "…" instead. */
const TITLE_MIN_SCALE = 0.7;

export interface PageTitleProps {
  title: string;
  /** A small label above the title (e.g. whose teams these are). */
  eyebrow?: string;
  /** Beside the eyebrow, at the right (an avatar, the sync badge). */
  right?: ReactNode;
  /** Above everything (the app's mark on the first screen). */
  mark?: ReactNode;
  /** `xl` for the tab screens (default), `l` for a longer title. */
  size?: 'xl' | 'l';
}

/**
 * v11: the title of a screen without a header (PLAN §46.1): the tab screens and the profile
 * picker open with it on the page.
 */
export function PageTitle({ title, eyebrow, right, mark, size = 'xl' }: PageTitleProps) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      {mark}
      {eyebrow !== undefined || right ? (
        <View style={styles.top}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow ?? ''}
          </Text>
          {right}
        </View>
      ) : null}
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={TITLE_MIN_SCALE}
        style={size === 'xl' ? styles.xl : styles.l}
      >
        {title}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget },
  eyebrow: { ...typography.eyebrow, color: theme.colors.textMuted, flex: 1 },
  xl: { ...typography.displayXL, color: theme.colors.text },
  l: { ...typography.displayL, color: theme.colors.text },
}));
