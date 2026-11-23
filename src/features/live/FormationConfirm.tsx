import { Text, View } from 'react-native';

import { Button, Dialog, useDialogStyles } from '@/components';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing } from '@/theme';

import { playerRef } from './format';
import type { PendingFormation } from './useSetupDraft';

export interface FormationConfirmProps {
  /** The formation change waiting for confirmation, or null (dialog hidden). */
  change: PendingFormation | null;
  playersById: Map<string, Player>;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * "Are you sure?" before a formation change in the next-set setup puts starters onto roles that
 * are none of their positions (v5, as when placing a player in the builder). Cancel keeps the
 * old formation.
 */
export function FormationConfirm({
  change,
  playersById,
  onConfirm,
  onCancel,
}: FormationConfirmProps) {
  const dialog = useDialogStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.live.setup;
  const list = (change?.offPosition ?? [])
    .map((o) => s.formationOffAs(playerRef(t, playersById, o.playerId), t.positions[o.role]))
    .join(', ');
  return (
    <Dialog
      visible={change !== null}
      onClose={onCancel}
      title={s.formationOffTitle}
      testID="formation-confirm"
    >
      <Text style={dialog.message}>{s.formationOff(list)}</Text>
      <View style={styles.actions}>
        <Button
          label={t.common.cancel}
          accessibilityLabel={s.formationCancelLabel}
          variant="secondary"
          onPress={onCancel}
          testID="formation-cancel"
        />
        <Button
          label={s.formationConfirm}
          accessibilityLabel={s.formationConfirmLabel}
          onPress={onConfirm}
          testID="formation-confirm-ok"
        />
      </View>
    </Dialog>
  );
}

const useStyles = makeStyles(() => ({
  // The dialog's button row, wrapping when the labels don't fit side by side.
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
}));
