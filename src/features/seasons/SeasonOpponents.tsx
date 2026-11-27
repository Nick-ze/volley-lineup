import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  TextField,
  useConfirm,
  useFormStyles,
  useListStyles,
} from '@/components';
import { MAX_NAME_LENGTH } from '@/domain/syncSchema';
import {
  opponentHasMatches,
  opponentRecords,
  validateOpponentName,
  type OpponentNameError,
} from '@/domain/seasons';
import { useT } from '@/i18n';
import { spacing } from '@/theme';
import {
  canEditTeamNow,
  useAppStore,
  useCanEdit,
  useMatchesForSeason,
  useOpponentsForSeason,
  useSeason,
} from '@/store';

import { OpponentRow } from './OpponentRow';
import { seasonErrorText } from './seasonErrors';

export interface SeasonOpponentsProps {
  seasonId: string;
  /** Tapping an opponent shows its matches. */
  onOpenOpponent: (opponentId: string) => void;
}

/**
 * The season's opponent teams with the record against each; add, rename, delete (no matches).
 * v10: view-only members only see the list and the records.
 */
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
  const teamId = useSeason(seasonId)?.teamId;
  const canEdit = useCanEdit(teamId);
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
    <View style={tabStyles.wrap}>
      {canEdit ? (
        <View style={formStyles.card}>
          <TextField
            label={s.name}
            maxLength={MAX_NAME_LENGTH}
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
      ) : null}
      {records.length === 0 ? <EmptyState>{s.empty}</EmptyState> : null}
      <View style={listStyles.list} testID="opponent-list">
        {records.map((r) => (
          <OpponentRow
            key={r.opponent.id}
            record={r}
            editable={canEdit}
            deletable={!opponentHasMatches(matches, r.opponent.id)}
            onOpen={() => onOpenOpponent(r.opponent.id)}
            onDelete={() =>
              ask(s.confirmDelete(r.opponent.name), () => {
                // The role may have changed while the question was open (v10 audit L18).
                if (canEditTeamNow(teamId)) useAppStore.getState().deleteOpponent(r.opponent.id);
              })
            }
          />
        ))}
      </View>
      {canEdit && anyBlocked ? <Text style={formStyles.hint}>{s.deleteBlocked}</Text> : null}
      <ConfirmDialog {...dialogProps} />
    </View>
  );
}

// v11: the tab's parts (form or search, list, hint) keep a clear distance from each other.
const tabStyles = StyleSheet.create({ wrap: { gap: spacing.md } });
