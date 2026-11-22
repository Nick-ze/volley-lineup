import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import { searchMatches } from '@/domain/matchSearch';
import { matchResultLabel } from '@/features/live/matchResult';
import { useT } from '@/i18n';
import { useAppStore, useMatchesForTeam } from '@/store';

import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ConfirmDialog';
import { ListRow } from './ListRow';
import { TextField } from './TextField';
import { listStyles as styles } from './styles';

export interface MatchesTabProps {
  teamId: string;
  onNewMatch: () => void;
  onOpenMatch: (matchId: string) => void;
}

/** The team's matches, newest first; v6.2: a search field filters by opponent or date. */
export function MatchesTab({ teamId, onNewMatch, onOpenMatch }: MatchesTabProps) {
  const t = useT();
  const matches = useMatchesForTeam(teamId);
  const deleteMatch = useAppStore((s) => s.deleteMatch);
  const { ask, dialogProps } = useConfirm();
  const s = t.roster.matches;
  const [query, setQuery] = useState('');
  const shown = searchMatches(matches, query);
  const searching = query.trim() !== '';

  return (
    <>
      <View style={styles.headerRow}>
        <View />
        <Button label={s.newMatch} onPress={onNewMatch} compact />
      </View>
      {matches.length === 0 && <Text style={styles.empty}>{s.empty}</Text>}
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
          <ListRow
            key={m.id}
            title={s.vs(m.opponent)}
            subtitle={
              <MatchSubtitle
                text={`${m.date} · ${m.home ? s.home : s.away}`}
                result={matchResultLabel(t, m)}
              />
            }
            onPress={() => onOpenMatch(m.id)}
            accessibilityLabel={rowLabel(
              s.open(m.opponent, m.date),
              matchResultLabel(t, m),
              t.match.resultLabel,
            )}
            actions={
              <Button
                label={t.common.delete}
                accessibilityLabel={s.delete(m.opponent)}
                variant="danger"
                compact
                onPress={() =>
                  ask(t.roster.confirm.deleteMatch(m.opponent), () => deleteMatch(m.id))
                }
              />
            }
          />
        ))}
      </View>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}

/** The row's screen-reader label: "Open match against …" plus the result, if any. */
function rowLabel(
  open: string,
  result: string | null,
  resultLabel: (text: string) => string,
): string {
  return result ? `${open}. ${resultLabel(result)}` : open;
}

/** Date · home/away on one line; the result (never truncated) on its own line below. */
function MatchSubtitle({ text, result }: { text: string; result: string | null }) {
  return (
    <>
      <Text style={styles.subtitle} numberOfLines={1}>
        {text}
      </Text>
      {result ? (
        <Text style={styles.subtitle} testID="match-row-result">
          {result}
        </Text>
      ) : null}
    </>
  );
}
