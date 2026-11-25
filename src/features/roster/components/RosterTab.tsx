import { useState } from 'react';
import { Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { Button, useListStyles } from '@/components';
import { rosterCardWidth, rosterColumns } from '@/domain/rosterGrid';
import { ScorerListButton } from '@/features/print/ScorerListButton';
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
      <View style={[styles.headerRow, styles.tabHeader]}>
        <Text style={styles.subtitle}>{t.roster.team.playerCount(players.length)}</Text>
        {/* v9.2: wraps below the count when both buttons don't fit (375 px, German, dyslexia font). */}
        <View style={grid.actions}>
          {players.length > 0 ? <ScorerListButton teamId={teamId} /> : null}
          <Button label={t.roster.roster.addPlayer} onPress={onAddPlayer} compact />
        </View>
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
}));
