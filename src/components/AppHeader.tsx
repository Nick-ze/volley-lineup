import type { NativeStackHeaderProps } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { headerTopInset } from '@/lib/headerTopInset';
import { headerVariant } from '@/lib/headerVariant';
import { makeStyles, maxContentWidth, spacing, touchTarget, useTheme } from '@/theme';

import { HeaderTitle, HeaderVariantContext } from './HeaderTitle';

/** Marks a call of a header option's render function as coming from `AppHeader`. */
const FROM_APP_HEADER = 'fromAppHeader';

/**
 * Wraps a screen's `headerLeft` / `headerTitle` / `headerRight` so it draws only inside
 * `AppHeader`. The native stack also calls these for its own (hidden) header; without this every
 * header button and title would be in the tree twice.
 */
export function appHeaderOnly<P extends object>(render: (props: P) => ReactNode) {
  return (props: P): ReactNode => (FROM_APP_HEADER in props ? render(props) : null);
}

/**
 * v11: the app's own header (PLAN §46.1), given to the root Stack as `header`. No bar: it sits on
 * the page background without a line. It draws what the screens already set: `headerLeft` (the
 * round back button), the title (`headerTitle` or `title`) and `headerRight` — each wrapped in
 * `appHeaderOnly` where it is set. Compact screens
 * show all three in one row; large ones (`headerVariant`) put the title on a row of its own;
 * bare ones show no title (the page has its own heading).
 */
export function AppHeader({ options, route, back }: NativeStackHeaderProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const variant = headerVariant(route.name);
  const item = { tintColor: colors.text, canGoBack: back !== undefined, [FROM_APP_HEADER]: true };
  const left = options.headerLeft?.(item);
  const right = options.headerRight?.(item);
  const text = options.title ?? '';
  const titleProps = { children: text, tintColor: colors.text, [FROM_APP_HEADER]: true };
  const title =
    typeof options.headerTitle === 'function' ? (
      options.headerTitle(titleProps)
    ) : (
      <HeaderTitle>{options.headerTitle ?? text}</HeaderTitle>
    );
  const paddingTop = headerTopInset(insets.top, options.presentation === 'modal');
  return (
    <HeaderVariantContext.Provider value={variant}>
      <View style={[styles.bar, { paddingTop }]} testID="app-header">
        <View style={styles.inner}>
          {variant === 'large' ? (
            <>
              <View style={styles.row}>
                {left}
                <View style={styles.grow} />
                {right}
              </View>
              <View style={styles.largeTitle}>{title}</View>
            </>
          ) : (
            <View style={styles.row}>
              {left}
              {variant === 'bare' ? (
                <View style={styles.grow} />
              ) : (
                <View style={styles.title}>{title}</View>
              )}
              {right}
            </View>
          )}
        </View>
      </View>
    </HeaderVariantContext.Provider>
  );
}

const useStyles = makeStyles((theme) => ({
  bar: { backgroundColor: theme.colors.background },
  // On wide screens the header lines up with the centred page below it (`Screen`).
  inner: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget + spacing.md,
    paddingHorizontal: spacing.md,
  },
  grow: { flex: 1 },
  // The title takes the room between the buttons and never pushes them off the row.
  title: { flex: 1, minWidth: 0 },
  largeTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm },
}));
