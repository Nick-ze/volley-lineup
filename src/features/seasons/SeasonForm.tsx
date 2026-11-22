import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import {
  SEASON_KINDS,
  validateSeasonForm,
  type SeasonFormField,
  type SeasonFormError,
  type SeasonFormResult,
} from '@/domain/seasons';
import type { Season } from '@/domain/types';
import { ChoiceChip } from '@/features/roster/components/ChoiceChip';
import { useFormStyles } from '@/features/roster/components/styles';
import { TextField } from '@/features/roster/components/TextField';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';

import { seasonErrorText } from './seasonErrors';

type Value = Extract<SeasonFormResult, { ok: true }>['value'];

export interface SeasonFormProps {
  teamId: string;
  /** The season being edited; undefined = create. */
  season?: Season;
  onSubmit: (value: Value) => void;
  onCancel: () => void;
  /** Edit mode: delete (the screen asks first). */
  onDelete?: () => void;
}

/** Name, Season / Tournament, optional start / end date (YYYY-MM-DD) and place. */
export function SeasonForm({ teamId, season, onSubmit, onCancel, onDelete }: SeasonFormProps) {
  const formStyles = useFormStyles();
  const t = useT();
  const s = t.seasons.form;
  const [name, setName] = useState(season?.name ?? '');
  const [kind, setKind] = useState(season?.kind ?? 'season');
  const [startDate, setStartDate] = useState(season?.startDate ?? '');
  const [endDate, setEndDate] = useState(season?.endDate ?? '');
  const [location, setLocation] = useState(season?.location ?? '');
  const [errors, setErrors] = useState<Partial<Record<SeasonFormField, SeasonFormError>>>({});
  const err = (f: SeasonFormField) => seasonErrorText(t, errors[f], 'season');

  const submit = () => {
    const input = { name, kind, startDate, endDate, location };
    const seasons = useAppStore.getState().seasons;
    const result = validateSeasonForm(input, seasons, teamId, season?.id ?? null);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) onSubmit(result.value);
  };

  return (
    <View style={formStyles.card}>
      <TextField
        label={s.name}
        value={name}
        onChangeText={setName}
        placeholder={s.namePlaceholder}
        error={err('name')}
        autoFocus={!season}
      />
      <Text style={formStyles.sectionLabel}>{s.kind}</Text>
      <View style={formStyles.actions} accessibilityRole="radiogroup" accessibilityLabel={s.kind}>
        {SEASON_KINDS.map((k) => (
          <ChoiceChip
            key={k}
            role="radio"
            label={t.seasons.kind[k]}
            selected={kind === k}
            onPress={() => setKind(k)}
            style={formStyles.grow}
            testID={`season-kind-${k}`}
          />
        ))}
      </View>
      <TextField
        label={s.startDate}
        value={startDate}
        onChangeText={setStartDate}
        placeholder={s.datePlaceholder}
        error={err('startDate')}
        maxLength={10}
      />
      <TextField
        label={s.endDate}
        value={endDate}
        onChangeText={setEndDate}
        placeholder={s.datePlaceholder}
        error={err('endDate')}
        maxLength={10}
      />
      <TextField
        label={s.location}
        value={location}
        onChangeText={setLocation}
        error={err('location')}
      />
      <View style={formStyles.actions}>
        {onDelete ? <Button label={s.delete} variant="danger" onPress={onDelete} /> : null}
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button label={season ? t.common.save : s.create} onPress={submit} />
      </View>
    </View>
  );
}
