import type { ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dialogMaxWidth, makeStyles, radius, spacing, touchTarget } from '@/theme';

/** Room kept free at the bottom: the app tab bar / team nav bar stay visible under the dim. */
const BAR_ROOM = touchTarget + spacing.md;

export interface TourSheetProps {
  /** Back button / Escape. */
  onClose: () => void;
  /** The dialog's name for screen readers (the tip's title). */
  label: string;
  testID?: string;
  children: ReactNode;
}

/**
 * v9.0: the coach-mark card of the tour — a dimmed screen with a card near the bottom, above the
 * tab bar or footer (safe area respected), like other mobile apps' tips. Scrolls when a long
 * tip (large font) doesn't fit.
 */
export function TourSheet({ onClose, label, testID, children }: TourSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: insets.bottom + BAR_ROOM }]}>
        <View
          style={styles.card}
          role="dialog"
          aria-modal
          aria-label={label}
          accessibilityLabel={label}
          accessibilityViewIsModal
          testID={testID}
        >
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: dialogMaxWidth,
    maxHeight: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  content: { padding: spacing.lg, gap: spacing.md },
}));
