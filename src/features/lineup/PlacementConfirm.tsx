import { Text, View } from 'react-native';

import { fullName } from '@/domain/playerNames';
import { Button, Dialog, useDialogStyles } from '@/components';
import { useT } from '@/i18n';

import type { LineupDraft } from './useLineupDraft';

/**
 * "Are you sure?" before a drag & drop / tap-to-select move or a formation change puts a player
 * on a spot whose role is none of their positions (one line per player, e.g. both players of a
 * swap). Cancel changes nothing; Confirm makes the change (the spot then shows "*").
 */
export function PlacementConfirm({ editor }: { editor: LineupDraft }) {
  const styles = useDialogStyles();
  const t = useT();
  const s = t.roles.confirm;
  const { pending, pendingKind, playerById, confirmPending, cancelPending } = editor;
  const lines = (pending ?? []).map((p) => {
    const player = playerById(p.playerId);
    const name = player ? t.roles.playerRef(player.number, fullName(player)) : '';
    return s.notListed(name, t.positions[p.role]);
  });

  return (
    <Dialog
      visible={pending !== null}
      onClose={cancelPending}
      title={s.title}
      testID="placement-confirm"
    >
      {lines.map((line) => (
        <Text key={line} style={styles.message}>
          {line}
        </Text>
      ))}
      <Text style={styles.message}>
        {pendingKind === 'formation'
          ? s.questionFormation
          : lines.length > 1
            ? s.questionMany
            : s.questionOne}
      </Text>
      <View style={styles.actions}>
        <Button
          label={s.cancel}
          accessibilityLabel={s.cancelLabel}
          variant="secondary"
          onPress={cancelPending}
          testID="placement-cancel"
        />
        <Button
          label={s.confirm}
          accessibilityLabel={
            pendingKind === 'formation' ? s.confirmFormationLabel : s.confirmLabel
          }
          onPress={confirmPending}
          testID="placement-confirm-button"
        />
      </View>
    </Dialog>
  );
}
