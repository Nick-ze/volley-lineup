import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components';
import {
  validateProfileForm,
  type FormErrors,
  type ProfileFormField,
  type ProfileFormInput,
} from '@/domain/roster';
import { FORM_PHOTO_SIZE, PhotoField } from '@/features/photos/PhotoField';
import { KEEP_PHOTO, type PhotoDraft } from '@/features/photos/photoDraft';
import { useT } from '@/i18n';
import { profileColors } from '@/theme';

import { errorText } from '../errorText';
import { LetterAvatar } from './Avatar';
import { ColorPicker } from './ColorPicker';
import { formStyles as styles } from './styles';
import { TextField } from './TextField';

export interface ProfileFormProps {
  initial?: ProfileFormInput;
  /** The profile's current photo (editing). */
  photoId?: string;
  submitLabel: string;
  /** `photo`: the picture to save (`applyPhotoDraft`). */
  onSubmit: (value: ProfileFormInput, photo: PhotoDraft) => void;
  onCancel: () => void;
}

/** Create / edit a manager profile (name, avatar colour, photo). */
export function ProfileForm({
  initial,
  photoId,
  submitLabel,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? profileColors[0]);
  const [errors, setErrors] = useState<FormErrors<ProfileFormField>>({});
  const [photo, setPhoto] = useState<PhotoDraft>(KEEP_PHOTO);
  // A picked picture is still being prepared: saving now would drop it.
  const [photoBusy, setPhotoBusy] = useState(false);

  const submit = () => {
    if (photoBusy) return;
    const result = validateProfileForm({ name, color });
    setErrors(result.errors);
    if (result.ok) onSubmit(result.value, photo);
  };

  return (
    <View style={styles.card}>
      <TextField
        label={t.roster.profiles.name}
        value={name}
        onChangeText={setName}
        error={errorText(t, errors.name)}
        onSubmitEditing={submit}
        autoFocus
      />
      <PhotoField
        photoId={photoId}
        draft={photo}
        onChange={setPhoto}
        onBusyChange={setPhotoBusy}
        fallback={<LetterAvatar name={name} color={color} size={FORM_PHOTO_SIZE} />}
      />
      <ColorPicker value={color} onChange={setColor} />
      <View style={styles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button label={submitLabel} onPress={submit} disabled={photoBusy} />
      </View>
    </View>
  );
}
