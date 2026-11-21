import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { colors, dialogMaxWidth, radius, spacing, typography } from '@/theme';

export interface ConfirmDialogProps {
  visible: boolean;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app confirmation (Alert.alert does not work on web). */
export function ConfirmDialog({
  visible,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {t.roster.confirm.title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
            <Button
              label={confirmLabel ?? t.common.delete}
              variant="danger"
              onPress={onConfirm}
              testID="confirm"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: dialogMaxWidth,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.subheading, color: colors.text },
  message: { ...typography.body, color: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
