import { Text, View } from 'react-native';

import { Button, Dialog } from '@/components';
import { useDescriptionLock } from '@/features/descriptions/descriptionLock';
import { StatusMessage } from '@/features/settings/StatusMessage';
import { useExport } from '@/features/settings/useExport';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

/** A team this device has an older, unlinked copy of. */
export interface LocalCopy {
  name: string;
  /** This account may edit the team (the cloud wins per record; else the copy is replaced). */
  manager: boolean;
}

export interface LocalCopyDialogProps {
  copies: LocalCopy[];
  /** The download is running: nothing can be chosen meanwhile. */
  busy?: boolean;
  /** Why the download failed, when it did (the question stays open). */
  error?: string | null;
  onReplace: () => void;
  onCancel: () => void;
}

/**
 * v10 audit M7: asked before a team's cloud version takes the place of an older copy of the team
 * on this device — when a team is joined again or downloaded. Offers a backup first: the same
 * export as Settings → Export (everything, with photos; descriptions only when switched on
 * there), with the same warning when the file couldn't be imported again.
 */
export function LocalCopyDialog({
  copies,
  busy = false,
  error = null,
  onReplace,
  onCancel,
}: LocalCopyDialogProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.sync.localCopy;
  const { exportData, status, busy: exporting, warning } = useExport();
  // As in Settings → Export: only while the descriptions are unlocked and chosen there.
  const includeDescriptions = useDescriptionLock((x) => x.unlocked && x.includeInExport);
  // While the download runs the dialog can't be closed (its result closes it or explains).
  const cancel = () => {
    if (!busy) onCancel();
  };
  const names = (manager: boolean) =>
    copies.filter((c) => c.manager === manager).map((c) => c.name);
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
        {s.body(names(false), names(true))}
      </Text>
      <Text style={styles.hint}>{s.exportHint}</Text>
      {warning ? (
        <Text
          style={styles.warning}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="local-copy-export-warning"
        >
          {warning}
        </Text>
      ) : null}
      <StatusMessage status={status} testID="local-copy-export-status" />
      {error ? (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="local-copy-error"
        >
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={s.export}
          accessibilityLabel={s.exportLabel}
          variant="secondary"
          disabled={busy || exporting}
          onPress={() => void exportData(undefined, { includeDescriptions })}
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
  hint: { ...typography.body, color: theme.colors.textMuted },
  // Yellow = warning, as in Settings → Export; the export itself stays possible.
  warning: { ...typography.body, color: theme.colors.highlightText },
  error: { ...typography.body, color: theme.colors.error },
  // The choices stacked, each as wide as the card (long German labels).
  actions: { gap: spacing.sm },
}));
