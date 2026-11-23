import type { ReactNode } from 'react';
import { Modal, Text, View, type ViewProps } from 'react-native';

import { dialogMaxWidth, makeStyles, radius, spacing, typography } from '@/theme';

/** Extra accessibility props for the dialog card (e.g. `role="dialog"` with its name). */
export type DialogCardProps = Pick<
  ViewProps,
  'role' | 'aria-modal' | 'accessibilityLabel' | 'aria-label'
>;

export interface DialogProps {
  /** Shown while true (default: shown while mounted). */
  visible?: boolean;
  /** Back button / Escape (`onRequestClose`). */
  onClose: () => void;
  /** The heading at the top of the card. */
  title: string;
  /** testID of the card. */
  testID?: string;
  cardProps?: DialogCardProps;
  /** The body and the buttons, below the title. */
  children: ReactNode;
}

/**
 * The in-app dialog shell (Alert.alert does nothing on web): a dimmed backdrop with a centred
 * card and its heading. Content and buttons go in `children`; `useDialogStyles` has the shared
 * message and button row styles.
 */
export function Dialog({
  visible = true,
  onClose,
  title,
  testID,
  cardProps,
  children,
}: DialogProps) {
  const styles = useDialogStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card} {...cardProps} accessibilityViewIsModal testID={testID}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export const useDialogStyles = makeStyles((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: dialogMaxWidth,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.subheading, color: theme.colors.text },
  message: { ...typography.body, color: theme.colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
}));
