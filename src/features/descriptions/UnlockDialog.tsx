import { Modal, Text, View } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { dialogMaxWidth, makeStyles, radius, spacing, typography } from '@/theme';

export interface UnlockDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The in-app confirmation used where the device has no biometrics / PIN (web, nothing set up). */
export function UnlockDialog({ visible, onConfirm, onCancel }: UnlockDialogProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.playerDetail.description;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal testID="unlock-dialog">
          <Text style={styles.title} accessibilityRole="header">
            {s.confirmTitle}
          </Text>
          <Text style={styles.message}>{s.confirmBody}</Text>
          <View style={styles.actions}>
            <Button label={s.cancel} variant="secondary" onPress={onCancel} />
            <Button label={s.confirm} onPress={onConfirm} testID="unlock-confirm" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
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
