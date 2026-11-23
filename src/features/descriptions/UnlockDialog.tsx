import { Text, View } from 'react-native';

import { Button, Dialog, useDialogStyles } from '@/components';
import { useT } from '@/i18n';

export interface UnlockDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The in-app confirmation used where the device has no biometrics / PIN (web, nothing set up). */
export function UnlockDialog({ visible, onConfirm, onCancel }: UnlockDialogProps) {
  const styles = useDialogStyles();
  const t = useT();
  const s = t.playerDetail.description;
  return (
    <Dialog visible={visible} onClose={onCancel} title={s.confirmTitle} testID="unlock-dialog">
      <Text style={styles.message}>{s.confirmBody}</Text>
      <View style={styles.actions}>
        <Button label={s.cancel} variant="secondary" onPress={onCancel} />
        <Button label={s.confirm} onPress={onConfirm} testID="unlock-confirm" />
      </View>
    </Dialog>
  );
}
