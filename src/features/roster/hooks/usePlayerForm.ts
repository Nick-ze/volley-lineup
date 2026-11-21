import { useState } from 'react';

import {
  validatePlayerForm,
  type FormErrors,
  type PlayerFormField,
  type PlayerFormInput,
} from '@/domain/roster';
import type { Player } from '@/domain/types';
import { applyPhotoDraft, KEEP_PHOTO, type PhotoDraft } from '@/features/photos/photoDraft';
import { useAppStore } from '@/store';

const emptyForm: PlayerFormInput = {
  firstName: '',
  lastName: '',
  number: '',
  positions: [],
  active: true,
};

const fromPlayer = (p: Player): PlayerFormInput => ({
  firstName: p.firstName,
  lastName: p.lastName,
  number: String(p.number),
  positions: [...p.positions],
  active: p.active,
});

/** Form state (incl. the unsaved picture) + validation + save for the player editor. */
export function usePlayerForm(teamId: string, player: Player | undefined) {
  const [form, setForm] = useState<PlayerFormInput>(() =>
    player ? fromPlayer(player) : emptyForm,
  );
  const [errors, setErrors] = useState<FormErrors<PlayerFormField>>({});
  const [photo, setPhoto] = useState<PhotoDraft>(KEEP_PHOTO);

  const set = <K extends PlayerFormField>(key: K, value: PlayerFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Validates and saves. Returns true on success. */
  const save = (): boolean => {
    const { players, addPlayer, updatePlayer } = useAppStore.getState();
    const result = validatePlayerForm(form, { players, teamId, playerId: player?.id });
    setErrors(result.errors);
    if (!result.ok) return false;
    const id = player ? player.id : addPlayer({ teamId, ...result.value }).id;
    if (player) updatePlayer(id, result.value);
    void applyPhotoDraft(photo, (photoId) => updatePlayer(id, { photoId }));
    return true;
  };

  return { form, set, errors, save, photo, setPhoto };
}
