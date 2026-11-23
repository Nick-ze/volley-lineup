import { Text, View } from 'react-native';

import { useT } from '@/i18n';

import { Button } from './Button';
import { Dialog, useDialogStyles } from './Dialog';

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
  const styles = useDialogStyles();
  const t = useT();
  return (
    <Dialog visible={visible} onClose={onCancel} title={t.roster.confirm.title}>
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
    </Dialog>
  );
}
