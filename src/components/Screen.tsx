import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, maxContentWidth, spacing } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Pinned below the content (e.g. a bottom nav bar); it handles the bottom safe area itself. */
  footer?: ReactNode;
  testID?: string;
}

/** Standard screen container: dark background, safe area, centred max width on desktop. */
export function Screen({ children, scroll = true, footer, testID }: ScreenProps) {
  const styles = useStyles();
  const inner = <View style={styles.inner}>{children}</View>;
  const edges = footer ? (['left', 'right'] as const) : (['bottom', 'left', 'right'] as const);
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
