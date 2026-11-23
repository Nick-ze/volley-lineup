import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import {
  matchingOpponent,
  validateNewMatch,
  type NewMatchErrors,
  type NewMatchValue,
} from '@/domain/matchForm';
import { DATE_INPUT_MAX_LENGTH, todayInput } from '@/domain/dates';
import { ChoiceChip } from '@/features/roster/components/ChoiceChip';
import { useFormStyles } from '@/features/roster/components/styles';
import { TextField } from '@/features/roster/components/TextField';
import { errorText } from '@/features/roster/errorText';
import { useT } from '@/i18n';
import { useOpponentsForSeason, useSeasonsForTeam } from '@/store';

import { OpponentPicker } from './OpponentPicker';
import { SeasonPicker } from './SeasonPicker';

export interface MatchFormProps {
  teamId: string;
  /** Opened from a season: the match goes into it (ignored when it isn't the team's). */
  seasonId?: string;
  onSubmit: (value: NewMatchValue) => void;
  onCancel: () => void;
}

/**
 * v7.0: season (fixed, a choice of the team's seasons, or a new one), opponent (a chip of the
 * season's opponents or a typed name), date (v8: dd.mm.yy, also dd.mm.yyyy / ISO; defaults to
 * today) and home / away.
 */
export function MatchForm({ teamId, seasonId, onSubmit, onCancel }: MatchFormProps) {
  const formStyles = useFormStyles();
  const t = useT();
  const seasons = useSeasonsForTeam(teamId);
  const fixed = seasons.some((x) => x.id === seasonId);
  const [season, setSeason] = useState(() => (fixed ? seasonId : seasons[0]?.id) ?? null);
  const [newSeasonName, setNewSeasonName] = useState(() => String(new Date().getFullYear()));
  const opponents = useOpponentsForSeason(season);
  const [chip, setChip] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => todayInput(new Date()));
  const [home, setHome] = useState(true);
  const [errors, setErrors] = useState<NewMatchErrors>({});
  const s = t.roster.matchForm;
  const selected =
    matchingOpponent(opponents, season, name)?.id ?? (name.trim() === '' ? chip : null);
  const seasonName = seasons.find((x) => x.id === season)?.name ?? newSeasonName.trim();

  const submit = () => {
    const input = {
      seasonId: season,
      newSeasonName,
      opponentId: chip,
      opponentName: name,
      date,
      home,
    };
    const result = validateNewMatch(input, { teamId, seasons, opponents });
    setErrors(result.errors);
    if (result.ok) onSubmit(result.value);
  };

  return (
    <View style={formStyles.card}>
      <SeasonPicker
        seasons={seasons}
        fixed={fixed}
        value={season}
        onChange={(id) => {
          setSeason(id);
          setChip(null); // the other season's opponents are different teams
        }}
        newName={newSeasonName}
        onNewName={setNewSeasonName}
        error={errorText(t, errors.season)}
      />
      <OpponentPicker
        opponents={opponents}
        seasonName={seasonName}
        selectedId={selected}
        onSelect={(id) => {
          setChip(id);
          setName('');
        }}
        name={name}
        onName={setName}
        error={errorText(t, errors.opponent)}
      />
      <TextField
        label={s.date}
        value={date}
        onChangeText={setDate}
        error={errorText(t, errors.date)}
        placeholder={t.appearance.dateHint}
        keyboardType="numbers-and-punctuation"
        maxLength={DATE_INPUT_MAX_LENGTH}
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
