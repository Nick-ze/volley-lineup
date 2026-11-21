import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import {
  toIsoDate,
  validateMatchForm,
  type FormErrors,
  type MatchFormField,
  type MatchFormInput,
} from '@/domain/roster';
import { useT } from '@/i18n';

import { errorText } from '../errorText';
import { ChoiceChip } from './ChoiceChip';
import { formStyles } from './styles';
import { TextField } from './TextField';

export interface MatchFormProps {
  onSubmit: (value: MatchFormInput) => void;
  onCancel: () => void;
}

/** Opponent, date (YYYY-MM-DD, defaults to today) and home / away. */
export function MatchForm({ onSubmit, onCancel }: MatchFormProps) {
  const t = useT();
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [home, setHome] = useState(true);
  const [errors, setErrors] = useState<FormErrors<MatchFormField>>({});
  const s = t.roster.matchForm;

  const submit = () => {
    const result = validateMatchForm({ opponent, date, home });
    setErrors(result.errors);
    if (result.ok) onSubmit(result.value);
  };

  return (
    <View style={formStyles.card}>
      <TextField
        label={s.opponent}
        value={opponent}
        onChangeText={setOpponent}
        error={errorText(t, errors.opponent)}
        autoFocus
      />
      <TextField
        label={s.date}
        value={date}
        onChangeText={setDate}
        error={errorText(t, errors.date)}
        maxLength={10}
      />
      <Text style={formStyles.sectionLabel}>{s.venue}</Text>
      <View style={formStyles.actions} accessibilityRole="radiogroup" accessibilityLabel={s.venue}>
        <ChoiceChip
          role="radio"
          label={t.roster.matches.home}
          selected={home}
          onPress={() => setHome(true)}
          style={formStyles.grow}
        />
        <ChoiceChip
          role="radio"
          label={t.roster.matches.away}
          selected={!home}
          onPress={() => setHome(false)}
          style={formStyles.grow}
        />
      </View>
      <View style={formStyles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button label={s.create} onPress={submit} />
      </View>
    </View>
  );
}
