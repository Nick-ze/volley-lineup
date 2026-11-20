import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components';
import {
  validateProfileForm,
  type FormErrors,
  type ProfileFormField,
  type ProfileFormInput,
} from '@/domain/roster';
import { t } from '@/i18n/en';
import { profileColors } from '@/theme';

import { errorText } from '../errorText';
import { ColorPicker } from './ColorPicker';
import { formStyles as styles } from './styles';
import { TextField } from './TextField';

export interface ProfileFormProps {
  initial?: ProfileFormInput;
  submitLabel: string;
  onSubmit: (value: ProfileFormInput) => void;
  onCancel: () => void;
}

/** Create / rename a manager profile (name + avatar colour). */
export function ProfileForm({ initial, submitLabel, onSubmit, onCancel }: ProfileFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? profileColors[0]);
  const [errors, setErrors] = useState<FormErrors<ProfileFormField>>({});

  const submit = () => {
    const result = validateProfileForm({ name, color });
    setErrors(result.errors);
    if (result.ok) onSubmit(result.value);
  };

  return (
    <View style={styles.card}>
      <TextField
        label={t.roster.profiles.name}
        value={name}
        onChangeText={setName}
        error={errorText(errors.name)}
        onSubmitEditing={submit}
        autoFocus
      />
      <ColorPicker value={color} onChange={setColor} />
      <View style={styles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button label={submitLabel} onPress={submit} />
      </View>
    </View>
  );
}
