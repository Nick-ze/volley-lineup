import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  TextField,
  ToggleRow,
  useConfirm,
  useFormStyles,
} from '@/components';
import { fullName } from '@/domain/playerNames';
import type { Player } from '@/domain/types';
import { NumberAvatar } from '@/features/photos/NumberAvatar';
import { FORM_PHOTO_SIZE, PhotoField } from '@/features/photos/PhotoField';
import { useT } from '@/i18n';

import { errorText } from '../errorText';
import { usePlayerForm } from '../hooks/usePlayerForm';
import { PositionPicker } from './PositionPicker';

export interface PlayerFormProps {
  teamId: string;
  /** The player to edit; omit to add a new one. */
  player?: Player;
  onDone: () => void;
  onDelete?: () => void;
  /** True when the player is part of a played set: deleting is not allowed (explained). */
  deleteBlocked?: boolean;
}

/** Add / edit a player (with photo) with inline validation. */
export function PlayerForm({
  teamId,
  player,
  onDone,
  onDelete,
  deleteBlocked = false,
}: PlayerFormProps) {
  const formStyles = useFormStyles();
  const t = useT();
  const { form, set, errors, save, photo, setPhoto } = usePlayerForm(teamId, player);
  const { ask, dialogProps } = useConfirm();
  // A picked picture is still being prepared: saving now would drop it.
  const [photoBusy, setPhotoBusy] = useState(false);
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
      <PhotoField
        photoId={player?.photoId}
        draft={photo}
        onChange={setPhoto}
        onBusyChange={setPhotoBusy}
        fallback={<NumberAvatar number={form.number} size={FORM_PHOTO_SIZE} />}
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
            disabled={deleteBlocked}
            accessibilityHint={deleteBlocked ? s.deleteBlocked : undefined}
            onPress={() => ask(t.roster.confirm.deletePlayer(fullName(player)), onDelete)}
          />
        )}
        <Button label={t.common.cancel} variant="secondary" onPress={onDone} />
        <Button label={t.common.save} disabled={photoBusy} onPress={() => save() && onDone()} />
      </View>
      {player && onDelete && deleteBlocked ? (
        <Text style={formStyles.hint}>{s.deleteBlocked}</Text>
      ) : null}
      <ConfirmDialog {...dialogProps} />
    </View>
  );
}
