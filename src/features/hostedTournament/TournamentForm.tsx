import { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner, Button, TextField, useFormStyles, useTrackStyles } from '@/components';
import { DATE_INPUT_MAX_LENGTH, formatDateInput } from '@/domain/dates';
import {
  DEFAULT_MATCH_END,
  DEFAULT_PLAN_KIND,
  DEFAULT_SETS_PER_MATCH,
  matchEndChoices,
  matchEndFor,
  MAX_TOURNAMENT_NAME_LENGTH,
  planKindLocked,
  settingsChangeBlock,
  tableCounts,
  validateTournamentForm,
  type SettingsBlock,
  type TournamentFormError,
  type TournamentFormField,
  type TournamentFormValue,
} from '@/domain/hostedTournament';
import { MAX_LOCATION_LENGTH } from '@/domain/seasons';
import {
  HOSTED_PLAN_KINDS,
  SETS_PER_MATCH,
  type HostedPlanKind,
  type HostedTournament,
  type MatchEnd,
} from '@/domain/types';
import { Segmented } from '@/features/lineup/Segmented';
import { useT } from '@/i18n';
import { useAppStore, useHostedResults } from '@/store';

import { StackedChoice } from './StackedChoice';
import { settingsBlockText, tournamentErrorText } from './tournamentText';

export interface TournamentFormProps {
  profileId: string;
  /** The tournament being edited; undefined = create. */
  tournament?: HostedTournament;
  onSubmit: (value: TournamentFormValue) => void;
  onCancel: () => void;
}

type SetsKey = `${(typeof SETS_PER_MATCH)[number]}`;

/**
 * Name, optional date and place, who makes the plan (v12.1: the app, or the coach adds the
 * matches), sets per match (1–5) and how a match ends ("best of N" only for 1, 3 and 5 sets),
 * with a line that says what the table counts. Editing refuses settings
 * that would make a stored result invalid and names the match.
 */
export function TournamentForm({ profileId, tournament, onSubmit, onCancel }: TournamentFormProps) {
  const formStyles = useFormStyles();
  const track = useTrackStyles();
  const t = useT();
  const s = t.tournament.form;
  const [name, setName] = useState(tournament?.name ?? '');
  const [date, setDate] = useState(formatDateInput(tournament?.date));
  const [location, setLocation] = useState(tournament?.location ?? '');
  const [setsPerMatch, setSetsPerMatch] = useState(
    tournament?.setsPerMatch ?? DEFAULT_SETS_PER_MATCH,
  );
  // What the coach chose; with 2 or 4 sets it rests and "all sets" applies.
  const [wantedEnd, setWantedEnd] = useState<MatchEnd>(tournament?.matchEnd ?? DEFAULT_MATCH_END);
  const [errors, setErrors] = useState<Partial<Record<TournamentFormField, TournamentFormError>>>(
    {},
  );
  const [block, setBlock] = useState<SettingsBlock | null>(null);
  // v12.1: who makes the plan; fixed once the tournament has results or matches.
  const [plan, setPlan] = useState<HostedPlanKind>(tournament?.plan ?? DEFAULT_PLAN_KIND);
  const planLocked = planKindLocked(tournament?.id ?? '', useHostedResults(tournament?.id));
  const matchEnd = matchEndFor(setsPerMatch, wantedEnd);
  const choices = matchEndChoices(setsPerMatch);
  const err = (field: TournamentFormField) => tournamentErrorText(t, errors[field]);
  const endText = (end: MatchEnd) => (end === 'bestOf' ? s.bestOf(setsPerMatch) : s.allSets);

  const submit = () => {
    const store = useAppStore.getState();
    const input = { name, date, location, setsPerMatch, matchEnd, plan };
    const result = validateTournamentForm(
      input,
      store.hostedTournaments,
      profileId,
      tournament?.id ?? null,
    );
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) return setBlock(null);
    const blocked = tournament
      ? settingsChangeBlock(tournament, result.value, store.hostedTeams, store.hostedResults)
      : null;
    setBlock(blocked);
    if (!blocked) onSubmit(result.value);
  };

  return (
    <View style={formStyles.card}>
      <TextField
        label={s.name}
        maxLength={MAX_TOURNAMENT_NAME_LENGTH}
        value={name}
        onChangeText={setName}
        placeholder={s.namePlaceholder}
        error={err('name')}
        autoFocus={!tournament}
        testID="tournament-name"
      />
      <TextField
        label={s.date}
        value={date}
        onChangeText={setDate}
        placeholder={s.datePlaceholder}
        keyboardType="numbers-and-punctuation"
        error={err('date')}
        maxLength={DATE_INPUT_MAX_LENGTH}
        testID="tournament-date"
      />
      <TextField
        label={s.location}
        maxLength={MAX_LOCATION_LENGTH}
        value={location}
        onChangeText={setLocation}
        error={err('location')}
        testID="tournament-location"
      />
      <Text style={formStyles.sectionLabel}>{s.plan}</Text>
      <StackedChoice<HostedPlanKind>
        groupLabel={s.plan}
        style={track.trackOnPanel}
        value={plan}
        onChange={setPlan}
        disabled={planLocked}
        options={HOSTED_PLAN_KINDS.map((kind) => ({
          value: kind,
          text: s.planOption[kind],
          testID: `tournament-plan-${kind}`,
        }))}
      />
      <Text style={formStyles.hint} testID="tournament-plan-hint">
        {planLocked ? `${s.planHint[plan]} ${s.planLocked}` : s.planHint[plan]}
      </Text>
      <Text style={formStyles.sectionLabel}>{s.setsPerMatch}</Text>
      <Segmented<SetsKey>
        groupLabel={s.setsPerMatch}
        style={track.trackOnPanel}
        value={`${setsPerMatch}`}
        onChange={(value) => {
          setSetsPerMatch(SETS_PER_MATCH.find((n) => `${n}` === value) ?? DEFAULT_SETS_PER_MATCH);
          setBlock(null);
        }}
        options={SETS_PER_MATCH.map((n) => ({
          value: `${n}` as const,
          text: `${n}`,
          label: s.setsOptionLabel(n),
          testID: `tournament-sets-${n}`,
        }))}
      />
      <Text style={formStyles.sectionLabel}>{s.matchEnd}</Text>
      <StackedChoice<MatchEnd>
        groupLabel={s.matchEnd}
        style={track.trackOnPanel}
        value={matchEnd}
        onChange={(value) => {
          setWantedEnd(value);
          setBlock(null);
        }}
        options={choices.map((end) => ({
          value: end,
          text: endText(end),
          testID: `tournament-end-${end}`,
        }))}
      />
      <Text style={formStyles.hint} testID="tournament-counts">
        {choices.length === 1 ? `${s.onlyAllSets(setsPerMatch)} ` : ''}
        {s.counts[tableCounts({ setsPerMatch, matchEnd })]}
      </Text>
      {block ? (
        <Banner alert testID="tournament-blocked">
          {settingsBlockText(t, block)}
        </Banner>
      ) : null}
      <View style={formStyles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button
          label={tournament ? t.common.save : s.create}
          onPress={submit}
          testID="tournament-save"
        />
      </View>
    </View>
  );
}
