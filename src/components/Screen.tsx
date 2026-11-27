import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { makeStyles, maxContentWidth, spacing } from '@/theme';

import { PageTitle, type PageTitleProps } from './PageTitle';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Pinned below the content (e.g. a bottom nav bar); it handles the bottom safe area itself. */
  footer?: ReactNode;
  /**
   * v11: for a screen without a header (the tab screens, the profile picker): its title on the
   * page. The screen then keeps clear of the status bar itself.
   */
  title?: PageTitleProps;
  testID?: string;
}

/** Standard screen container: page background, safe area, centred max width on desktop. */
export function Screen({ children, scroll = true, footer, title, testID }: ScreenProps) {
  const styles = useStyles();
  const inner = (
    <View style={styles.inner}>
      {title ? <PageTitle {...title} /> : null}
      {children}
    </View>
  );
  const edges: Edge[] = footer ? ['left', 'right'] : ['bottom', 'left', 'right'];
  if (title) edges.push('top');
  return (
    <SafeAreaView style={styles.safe} edges={edges} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
}));
