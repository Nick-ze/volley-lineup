import { Text, View } from 'react-native';

import { Button } from '@/components';
import { t } from '@/i18n/en';
import { useAppStore, useMatchesForTeam } from '@/store';

import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ConfirmDialog';
import { ListRow } from './ListRow';
import { listStyles as styles } from './styles';

export interface MatchesTabProps {
  teamId: string;
  onNewMatch: () => void;
  onOpenMatch: (matchId: string) => void;
}

/** The team's matches, newest first. */
export function MatchesTab({ teamId, onNewMatch, onOpenMatch }: MatchesTabProps) {
  const matches = useMatchesForTeam(teamId);
  const deleteMatch = useAppStore((s) => s.deleteMatch);
  const { ask, dialogProps } = useConfirm();
  const s = t.roster.matches;

  return (
    <>
      <View style={styles.headerRow}>
        <View />
        <Button label={s.newMatch} onPress={onNewMatch} compact />
      </View>
      {matches.length === 0 && <Text style={styles.empty}>{s.empty}</Text>}
      <View style={styles.list}>
        {matches.map((m) => (
          <ListRow
            key={m.id}
            title={s.vs(m.opponent)}
            subtitle={`${m.date} · ${m.home ? s.home : s.away}`}
            onPress={() => onOpenMatch(m.id)}
            accessibilityLabel={s.open(m.opponent, m.date)}
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
