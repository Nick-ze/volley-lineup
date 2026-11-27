import { createContext, useContext, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { HeaderVariant } from '@/lib/headerVariant';
import { makeStyles, spacing, typography } from '@/theme';

/** v11: the header's variant, set by `AppHeader` for the title it renders. */
export const HeaderVariantContext = createContext<HeaderVariant>('compact');

/** Below this factor a large title stops shrinking and ends in "…" instead. */
const LARGE_TITLE_MIN_SCALE = 0.75;

/**
 * The title of the app's header (v11: `AppHeader`), on one line: long titles (e.g. "vs <long
 * opponent>") end in "…". Compact headers show it beside the back button; large headers on a row
 * of its own, where it first shrinks a little. `leading` is e.g. the team picture before the
 * name; `subtitle` a quiet second line (the match screen's season and status).
 */
export function HeaderTitle({
  children,
  leading,
  subtitle,
  testID,
}: {
  children: string;
  leading?: ReactNode;
  /** A quiet second line: a text, or small elements in a row. */
  subtitle?: ReactNode;
  /** For the title text. */
  testID?: string;
}) {
  const styles = useStyles();
  const large = useContext(HeaderVariantContext) === 'large';
  const title = (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      adjustsFontSizeToFit={large}
      minimumFontScale={large ? LARGE_TITLE_MIN_SCALE : undefined}
      style={large ? styles.large : styles.compact}
      testID={testID}
    >
      {children}
    </Text>
  );
  const text =
    subtitle === undefined || subtitle === null ? (
      title
    ) : (
      <View style={styles.text}>
        {title}
        {typeof subtitle === 'string' ? (
          <Text style={styles.subtitle} numberOfLines={1} testID="header-subtitle">
            {subtitle}
          </Text>
        ) : (
          <View style={styles.subtitleRow} testID="header-subtitle">
            {subtitle}
          </View>
        )}
      </View>
    );
  if (!leading) return text;
  return (
    <View style={styles.row}>
      {leading}
      {text}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  compact: { ...typography.displayM, color: theme.colors.text, flexShrink: 1 },
  large: { ...typography.displayL, color: theme.colors.text, flexShrink: 1 },
  text: { flexShrink: 1 },
  subtitle: { ...typography.caption, color: theme.colors.textMuted },
  // Its parts share a line when they fit and otherwise take one line each; a part that is still
  // too long ends in "…" (the parts are one-line texts that may shrink).
  subtitleRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
}));
