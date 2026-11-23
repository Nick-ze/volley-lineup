import { useMemo } from 'react';
import { Text } from 'react-native';

import { useListStyles } from '@/components';
import { playerSeason } from '@/domain/performance';
import type { Player } from '@/domain/types';
import { DescriptionSection } from '@/features/descriptions/DescriptionSection';
import { useT } from '@/i18n';
import { useMatchesForTeam, usePlayersForTeam } from '@/store';

import { PlayerHeader } from './PlayerHeader';
import { PlayerMatchList } from './PlayerMatchList';
import { SeasonStats } from './SeasonStats';

export interface PlayerDetailProps {
  player: Player;
  onEdit: () => void;
  onOpenMatch: (matchId: string) => void;
}

/** Player detail (PLAN §25.2): header, season stats, matches, confidential description. */
export function PlayerDetail({ player, onEdit, onOpenMatch }: PlayerDetailProps) {
  const listStyles = useListStyles();
  const t = useT();
  const matches = useMatchesForTeam(player.teamId);
  const players = usePlayersForTeam(player.teamId);
  const season = useMemo(
    () => playerSeason(matches, players, player.id),
    [matches, players, player.id],
  );
  return (
    <>
      <PlayerHeader player={player} onEdit={onEdit} />
      {season.matches.length === 0 ? (
        <Text style={listStyles.empty} testID="player-detail-empty">
          {t.playerDetail.season.empty}
        </Text>
      ) : (
        <>
          <SeasonStats season={season} />
          <PlayerMatchList lines={season.matches} onOpenMatch={onOpenMatch} />
        </>
      )}
      <DescriptionSection player={player} />
    </>
  );
}
