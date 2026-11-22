import { Text, View } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { useAppStore, usePlayersForTeam } from '@/store';

import { PlayerRow } from './PlayerRow';
import { useListStyles } from './styles';

export interface RosterTabProps {
  teamId: string;
  onAddPlayer: () => void;
  /** Opens the player detail screen (v6; it has the Edit button). */
  onOpenPlayer: (playerId: string) => void;
}

/** Players sorted by jersey number, with quick active / injured toggle. */
export function RosterTab({ teamId, onAddPlayer, onOpenPlayer }: RosterTabProps) {
  const styles = useListStyles();
  const t = useT();
  const players = usePlayersForTeam(teamId);
  const updatePlayer = useAppStore((s) => s.updatePlayer);

  return (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>{t.roster.team.playerCount(players.length)}</Text>
        <Button label={t.roster.roster.addPlayer} onPress={onAddPlayer} compact />
      </View>
      {players.length === 0 && <Text style={styles.empty}>{t.roster.roster.empty}</Text>}
      <View style={styles.list}>
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            onPress={() => onOpenPlayer(p.id)}
            onToggleActive={() => updatePlayer(p.id, { active: !p.active })}
          />
        ))}
      </View>
    </>
  );
}
