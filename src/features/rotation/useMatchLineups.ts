import { useMemo } from 'react';

import type { Match, Player } from '@/domain/types';
import { useMatch, usePlayersForTeam } from '@/store';

export interface MatchLineups {
  match: Match | undefined;
  /** Sets sorted by set number. */
  sets: Match['sets'];
  playersById: Map<string, Player>;
}

/** The match, its sets (sorted) and a lookup of the team's players. */
export function useMatchLineups(matchId: string | undefined): MatchLineups {
  const match = useMatch(matchId);
  const players = usePlayersForTeam(match?.teamId);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const sets = useMemo(
    () => [...(match?.sets ?? [])].sort((a, b) => a.setNumber - b.setNumber),
    [match?.sets],
  );
  return { match, sets, playersById };
}
