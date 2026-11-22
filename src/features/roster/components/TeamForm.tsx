import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components';
import {
  validateTeamForm,
  type FormErrors,
  type TeamFormField,
  type TeamFormValue,
} from '@/domain/roster';
import { useT } from '@/i18n';

import { errorText } from '../errorText';
import { useFormStyles } from './styles';
import { TextField } from './TextField';

export interface TeamFormProps {
  initial?: TeamFormValue;
  submitLabel: string;
  onSubmit: (value: TeamFormValue) => void;
  onCancel: () => void;
}

/**
 * Create / edit a team (name). v7: seasons are their own boxes now, so the old free-text season
 * isn't shown any more; an existing value is kept as it is (it named the upgraded season).
 */
export function TeamForm({ initial, submitLabel, onSubmit, onCancel }: TeamFormProps) {
  const styles = useFormStyles();
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [season] = useState(initial?.season ?? '');
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
        error={errorText(t, errors.name)}
        autoFocus
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button label={submitLabel} onPress={submit} />
      </View>
    </View>
  );
}
