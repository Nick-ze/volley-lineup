import { Text } from 'react-native';

import { IconButton, ListRow, useListStyles } from '@/components';
import { formatDate } from '@/domain/dates';
import type { Match } from '@/domain/types';
import { matchResultLabel } from '@/features/live/matchResult';
import { useT } from '@/i18n';

export interface MatchRowProps {
  match: Match;
  onOpen: () => void;
  /** v10: undefined for view-only members (no Delete). */
  onDelete?: () => void;
}

/** One match of a season: "vs X", date · home/away, the result, and Delete. */
export function MatchRow({ match: m, onOpen, onDelete }: MatchRowProps) {
  const t = useT();
  const s = t.roster.matches;
  const result = matchResultLabel(t, m);
  const date = formatDate(m.date);
  const open = s.open(m.opponent, date);
  return (
    <ListRow
      title={s.vs(m.opponent)}
      subtitle={<MatchSubtitle text={`${date} · ${m.home ? s.home : s.away}`} result={result} />}
      onPress={onOpen}
      accessibilityLabel={result ? `${open}. ${t.match.resultLabel(result)}` : open}
      actions={
        onDelete ? (
          <IconButton
            icon="trash-outline"
            accessibilityLabel={s.delete(m.opponent)}
            onPress={onDelete}
          />
        ) : undefined
      }
    />
  );
}

/** Date · home/away on one line; the result (never truncated) on its own line below. */
function MatchSubtitle({ text, result }: { text: string; result: string | null }) {
  const styles = useListStyles();
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
