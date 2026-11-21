import { View } from 'react-native';

import { Button, ToggleRow } from '@/components';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';

import { errorText } from '../errorText';
import { useConfirm } from '../hooks/useConfirm';
import { usePlayerForm } from '../hooks/usePlayerForm';
import { ConfirmDialog } from './ConfirmDialog';
import { PositionPicker } from './PositionPicker';
import { formStyles } from './styles';
import { TextField } from './TextField';

export interface PlayerFormProps {
  teamId: string;
  /** The player to edit; omit to add a new one. */
  player?: Player;
  onDone: () => void;
  onDelete?: () => void;
}

/** Add / edit a player with inline validation. */
export function PlayerForm({ teamId, player, onDone, onDelete }: PlayerFormProps) {
  const t = useT();
  const { form, set, errors, save } = usePlayerForm(teamId, player);
  const { ask, dialogProps } = useConfirm();
  const s = t.roster.player;

  return (
    <View style={formStyles.card}>
      <TextField
        label={s.firstName}
        value={form.firstName}
        onChangeText={(v) => set('firstName', v)}
        error={errorText(t, errors.firstName)}
        autoFocus={!player}
      />
      <TextField
        label={s.lastName}
        value={form.lastName}
        onChangeText={(v) => set('lastName', v)}
        error={errorText(t, errors.lastName)}
      />
      <TextField
        label={s.number}
        value={form.number}
        onChangeText={(v) => set('number', v)}
        error={errorText(t, errors.number)}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={3}
      />
      <PositionPicker
        value={form.positions}
        onChange={(v) => set('positions', v)}
        error={errorText(t, errors.positions)}
      />
      <ToggleRow label={s.activeLabel} value={form.active} onChange={(v) => set('active', v)} />
      <View style={formStyles.actions}>
        {player && onDelete && (
          <Button
            label={s.delete}
            variant="danger"
            onPress={() =>
              ask(t.roster.confirm.deletePlayer(`${player.firstName} ${player.lastName}`), onDelete)
            }
          />
        )}
        <Button label={t.common.cancel} variant="secondary" onPress={onDone} />
        <Button label={t.common.save} onPress={() => save() && onDone()} />
      </View>
      <ConfirmDialog {...dialogProps} />
    </View>
  );
}
