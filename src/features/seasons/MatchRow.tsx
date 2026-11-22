import { Text } from 'react-native';

import { Button } from '@/components';
import type { Match } from '@/domain/types';
import { matchResultLabel } from '@/features/live/matchResult';
import { ListRow } from '@/features/roster/components/ListRow';
import { useListStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';

export interface MatchRowProps {
  match: Match;
  onOpen: () => void;
  onDelete: () => void;
}

/** One match of a season: "vs X", date · home/away, the result, and Delete. */
export function MatchRow({ match: m, onOpen, onDelete }: MatchRowProps) {
  const t = useT();
  const s = t.roster.matches;
  const result = matchResultLabel(t, m);
  const open = s.open(m.opponent, m.date);
  return (
    <ListRow
      title={s.vs(m.opponent)}
      subtitle={<MatchSubtitle text={`${m.date} · ${m.home ? s.home : s.away}`} result={result} />}
      onPress={onOpen}
      accessibilityLabel={result ? `${open}. ${t.match.resultLabel(result)}` : open}
      actions={
        <Button
          label={t.common.delete}
          accessibilityLabel={s.delete(m.opponent)}
          variant="danger"
          compact
          onPress={onDelete}
        />
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
