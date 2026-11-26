import { useState } from 'react';
import { View } from 'react-native';

import { MAX_NAME_LENGTH } from '@/domain/syncSchema';
import { Button, TeamAvatar, TextField, useFormStyles } from '@/components';
import {
  validateTeamForm,
  type FormErrors,
  type TeamFormField,
  type TeamFormValue,
} from '@/domain/roster';
import { FORM_PHOTO_SIZE, PhotoField } from '@/features/photos/PhotoField';
import { KEEP_PHOTO, type PhotoDraft } from '@/features/photos/photoDraft';
import { useT } from '@/i18n';

import { errorText } from '../errorText';

export interface TeamFormProps {
  initial?: TeamFormValue;
  /** The team being edited (its id picks the initial's colour; its current picture). */
  team?: { id: string; photoId?: string };
  submitLabel: string;
  /** `photo`: the picture to save (`applyPhotoDraft`). */
  onSubmit: (value: TeamFormValue, photo: PhotoDraft) => void;
  onCancel: () => void;
}

/**
 * Create / edit a team (name; v8: picture). v7: seasons are their own boxes now, so the old free-text season
 * isn't shown any more; an existing value is kept as it is (it named the upgraded season).
 */
export function TeamForm({ initial, team, submitLabel, onSubmit, onCancel }: TeamFormProps) {
  const styles = useFormStyles();
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [season] = useState(initial?.season ?? '');
  const [errors, setErrors] = useState<FormErrors<TeamFormField>>({});
  const [photo, setPhoto] = useState<PhotoDraft>(KEEP_PHOTO);
  // A picked picture is still being prepared: saving now would drop it.
  const [photoBusy, setPhotoBusy] = useState(false);
  const p = t.teamPhoto;

  const submit = () => {
    if (photoBusy) return;
    const result = validateTeamForm({ name, season });
    setErrors(result.errors);
    if (result.ok) onSubmit(result.value, photo);
  };

  return (
    <View style={styles.card}>
      <TextField
        label={t.roster.teams.name}
        maxLength={MAX_NAME_LENGTH}
        value={name}
        onChangeText={setName}
        error={errorText(t, errors.name)}
        autoFocus
        onSubmitEditing={submit}
      />
      <PhotoField
        photoId={team?.photoId}
        draft={photo}
        onChange={setPhoto}
        onBusyChange={setPhotoBusy}
        labels={p}
        fallback={
          <View accessible accessibilityLabel={p.initialOf(name)}>
            <TeamAvatar team={{ id: team?.id ?? '', name }} size={FORM_PHOTO_SIZE} />
          </View>
        }
      />
      <View style={styles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button label={submitLabel} onPress={submit} disabled={photoBusy} />
      </View>
    </View>
  );
}
