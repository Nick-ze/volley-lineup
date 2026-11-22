import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import { searchMatches } from '@/domain/matchSearch';
import type { Opponent } from '@/domain/types';
import { ConfirmDialog } from '@/features/roster/components/ConfirmDialog';
import { TextField } from '@/features/roster/components/TextField';
import { useListStyles } from '@/features/roster/components/styles';
import { useConfirm } from '@/features/roster/hooks/useConfirm';
import { useT } from '@/i18n';
import { useAppStore, useMatchesForSeason } from '@/store';

import { MatchRow } from './MatchRow';

export interface SeasonMatchesProps {
  seasonId: string;
  /** Only matches against this opponent (a removable chip); undefined = all. */
  opponent?: Opponent;
  onClearOpponent: () => void;
  onNewMatch: () => void;
  onOpenMatch: (matchId: string) => void;
}

/**
 * The season's matches, newest first, with the v6.2 search (opponent or date) and an optional
 * opponent filter (set by tapping an opponent on the Opponents tab).
 */
export function SeasonMatches({
  seasonId,
  opponent,
  onClearOpponent,
  onNewMatch,
  onOpenMatch,
}: SeasonMatchesProps) {
  const styles = useListStyles();
  const t = useT();
  const all = useMatchesForSeason(seasonId);
  const deleteMatch = useAppStore((st) => st.deleteMatch);
  const { ask, dialogProps } = useConfirm();
  const s = t.roster.matches;
  const [query, setQuery] = useState('');
  const matches = opponent ? all.filter((m) => m.opponentId === opponent.id) : all;
  const shown = searchMatches(matches, query);
  const searching = query.trim() !== '';

  return (
    <>
      <View style={styles.headerRow}>
        {opponent ? (
          <Button
            label={t.seasons.matches.filter(opponent.name)}
            accessibilityLabel={t.seasons.matches.filterLabel(opponent.name)}
            variant="secondary"
            compact
            onPress={onClearOpponent}
            testID="opponent-filter"
          />
        ) : (
          <View />
        )}
        <Button label={s.newMatch} onPress={onNewMatch} compact />
      </View>
      {matches.length === 0 && (
        <Text style={styles.empty}>
          {opponent ? t.seasons.matches.emptyFor(opponent.name) : t.seasons.matches.empty}
        </Text>
      )}
      {matches.length > 0 && (
        <TextField
          label={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder={s.searchPlaceholder}
          testID="match-search"
        />
      )}
      {searching && (
        <Text style={styles.empty} accessibilityLiveRegion="polite" testID="match-search-status">
          {shown.length === 0
            ? s.noResults(query.trim())
            : s.resultCount(shown.length, matches.length)}
        </Text>
      )}
      <View style={styles.list}>
        {shown.map((m) => (
          <MatchRow
            key={m.id}
            match={m}
            onOpen={() => onOpenMatch(m.id)}
            onDelete={() => ask(t.roster.confirm.deleteMatch(m.opponent), () => deleteMatch(m.id))}
          />
        ))}
      </View>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
