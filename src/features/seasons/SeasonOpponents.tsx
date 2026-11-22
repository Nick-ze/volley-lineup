import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import {
  opponentHasMatches,
  opponentRecords,
  validateOpponentName,
  type OpponentNameError,
} from '@/domain/seasons';
import { ConfirmDialog } from '@/features/roster/components/ConfirmDialog';
import { TextField } from '@/features/roster/components/TextField';
import { useFormStyles, useListStyles } from '@/features/roster/components/styles';
import { useConfirm } from '@/features/roster/hooks/useConfirm';
import { useT } from '@/i18n';
import { useAppStore, useMatchesForSeason, useOpponentsForSeason } from '@/store';

import { OpponentRow } from './OpponentRow';
import { seasonErrorText } from './seasonErrors';

export interface SeasonOpponentsProps {
  seasonId: string;
  /** Tapping an opponent shows its matches. */
  onOpenOpponent: (opponentId: string) => void;
}

/** The season's opponent teams with the record against each; add, rename, delete (no matches). */
export function SeasonOpponents({ seasonId, onOpenOpponent }: SeasonOpponentsProps) {
  const formStyles = useFormStyles();
  const listStyles = useListStyles();
  const t = useT();
  const s = t.seasons.opponents;
  const opponents = useOpponentsForSeason(seasonId);
  const matches = useMatchesForSeason(seasonId);
  const records = useMemo(
    () => opponentRecords(opponents, matches, seasonId),
    [opponents, matches, seasonId],
  );
  const [name, setName] = useState('');
  const [error, setError] = useState<OpponentNameError | undefined>();
  const { ask, dialogProps } = useConfirm();
  const anyBlocked = opponents.some((o) => opponentHasMatches(matches, o.id));

  const add = () => {
    const store = useAppStore.getState();
    const result = validateOpponentName(name, store.opponents, seasonId);
    if (!result.ok) return setError(result.error);
    store.addOpponent(seasonId, result.name);
    setName('');
    setError(undefined);
  };

  return (
    <>
      <View style={formStyles.card}>
        <TextField
          label={s.name}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(undefined);
          }}
          placeholder={s.namePlaceholder}
          error={seasonErrorText(t, error, 'opponent')}
          onSubmitEditing={add}
          testID="opponent-name"
        />
        <View style={formStyles.actions}>
          <Button label={s.add} accessibilityLabel={s.addLabel} compact onPress={add} />
        </View>
      </View>
      {records.length === 0 ? <Text style={listStyles.empty}>{s.empty}</Text> : null}
      <View style={listStyles.list} testID="opponent-list">
        {records.map((r) => (
          <OpponentRow
            key={r.opponent.id}
            record={r}
            deletable={!opponentHasMatches(matches, r.opponent.id)}
            onOpen={() => onOpenOpponent(r.opponent.id)}
            onDelete={() =>
              ask(s.confirmDelete(r.opponent.name), () =>
                useAppStore.getState().deleteOpponent(r.opponent.id),
              )
            }
          />
        ))}
      </View>
      {anyBlocked ? <Text style={formStyles.hint}>{s.deleteBlocked}</Text> : null}
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
