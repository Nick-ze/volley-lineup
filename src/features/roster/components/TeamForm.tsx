import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components';
import {
  validateTeamForm,
  type FormErrors,
  type TeamFormField,
  type TeamFormValue,
} from '@/domain/roster';
import { t } from '@/i18n/en';

import { errorText } from '../errorText';
import { formStyles as styles } from './styles';
import { TextField } from './TextField';

export interface TeamFormProps {
  initial?: TeamFormValue;
  submitLabel: string;
  onSubmit: (value: TeamFormValue) => void;
  onCancel: () => void;
}

/** Create / edit a team (name + optional season). */
export function TeamForm({ initial, submitLabel, onSubmit, onCancel }: TeamFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [season, setSeason] = useState(initial?.season ?? '');
  const [errors, setErrors] = useState<FormErrors<TeamFormField>>({});

  const submit = () => {
    const result = validateTeamForm({ name, season });
    setErrors(result.errors);
    if (result.ok) onSubmit(result.value);
  };

  return (
    <View style={styles.card}>
      <TextField
        label={t.roster.teams.name}
        value={name}
        onChangeText={setName}
        error={errorText(errors.name)}
        autoFocus
      />
      <TextField
        label={t.roster.teams.season}
        value={season}
        onChangeText={setSeason}
        placeholder={t.roster.teams.seasonPlaceholder}
        error={errorText(errors.season)}
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button label={submitLabel} onPress={submit} />
      </View>
    </View>
  );
}
