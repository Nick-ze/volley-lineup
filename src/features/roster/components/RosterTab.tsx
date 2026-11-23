import { useState } from 'react';
import { Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { Button, useListStyles } from '@/components';
import { rosterCardWidth, rosterColumns } from '@/domain/rosterGrid';
import { useT } from '@/i18n';
import { useAppStore, usePlayersForTeam } from '@/store';
import { makeStyles, maxContentWidth, spacing } from '@/theme';

import { PlayerCard } from './PlayerCard';

export interface RosterTabProps {
  teamId: string;
  onAddPlayer: () => void;
  /** Opens the player detail screen (v6; it has the Edit button). */
  onOpenPlayer: (playerId: string) => void;
}

/** Gap between the player cards. */
const GAP = spacing.sm;

/** v8: the players as cards (2 columns on a phone, more on wide screens), by jersey number. */
export function RosterTab({ teamId, onAddPlayer, onOpenPlayer }: RosterTabProps) {
  const styles = useListStyles();
  const grid = useGridStyles();
  const t = useT();
  const players = usePlayersForTeam(teamId);
  const updatePlayer = useAppStore((s) => s.updatePlayer);
  const window = useWindowDimensions();
  // Until the grid has measured itself: the screen's content width (window minus padding).
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? Math.min(window.width, maxContentWidth) - 2 * spacing.lg;
  const columns = rosterColumns(width, GAP);
  const cardWidth = rosterCardWidth(width, columns, GAP);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setMeasured(w);
  };

  return (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>{t.roster.team.playerCount(players.length)}</Text>
        <Button label={t.roster.roster.addPlayer} onPress={onAddPlayer} compact />
      </View>
      {players.length === 0 && <Text style={styles.empty}>{t.roster.roster.empty}</Text>}
      <View style={grid.grid} onLayout={onLayout} testID="roster-grid">
        {players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            width={cardWidth}
            onPress={() => onOpenPlayer(p.id)}
            onToggleActive={() => updatePlayer(p.id, { active: !p.active })}
          />
        ))}
      </View>
    </>
  );
}

const useGridStyles = makeStyles(() => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
}));
