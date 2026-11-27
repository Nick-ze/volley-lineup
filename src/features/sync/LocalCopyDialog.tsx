import { Text, View } from 'react-native';

import { Button, Dialog } from '@/components';
import { StatusMessage } from '@/features/settings/StatusMessage';
import { useExport } from '@/features/settings/useExport';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

export interface LocalCopyDialogProps {
  /** The teams this device has an older, unlinked copy of. */
  teamNames: string[];
  /** This account may edit every one of them (the cloud wins per record; else: replaced). */
  manager: boolean;
  /** The download is running: nothing can be chosen meanwhile. */
  busy?: boolean;
  onReplace: () => void;
  onCancel: () => void;
}

/**
 * v10 audit M7: asked before a team's cloud version takes the place of an older copy of the team
 * on this device — when a team is joined again, downloaded, or its copy is shared. Offers a
 * backup first (the same export as Settings → Export: everything, with photos).
 */
export function LocalCopyDialog({
  teamNames,
  manager,
  busy = false,
  onReplace,
  onCancel,
}: LocalCopyDialogProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.sync.localCopy;
  const { exportData, status, busy: exporting } = useExport();
  // While the download runs the dialog can't be closed (its result closes it or explains).
  const cancel = () => {
    if (!busy) onCancel();
  };
  return (
    <Dialog
      onClose={cancel}
      title={s.title}
      testID="local-copy-dialog"
      cardProps={{
        role: 'dialog',
        'aria-modal': true,
        accessibilityLabel: s.title,
        'aria-label': s.title,
      }}
    >
      <Text style={styles.body} testID="local-copy-body">
        {s.body(teamNames, manager)}
      </Text>
      <StatusMessage status={status} testID="local-copy-export-status" />
      <View style={styles.actions}>
        <Button
          label={s.export}
          accessibilityLabel={s.exportLabel}
          variant="secondary"
          disabled={busy || exporting}
          onPress={() => void exportData()}
          testID="local-copy-export"
        />
        <Button
          label={s.replace}
          accessibilityLabel={s.replaceLabel}
          variant="danger"
          disabled={busy}
          onPress={onReplace}
          testID="local-copy-replace"
        />
        <Button
          label={s.cancel}
          accessibilityLabel={s.cancelLabel}
          variant="ghost"
          disabled={busy}
          onPress={cancel}
          testID="local-copy-cancel"
        />
      </View>
    </Dialog>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...typography.body, color: theme.colors.text },
  // The choices stacked, each as wide as the card (long German labels).
  actions: { gap: spacing.sm },
}));
