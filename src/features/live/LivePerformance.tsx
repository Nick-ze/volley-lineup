import { useState } from 'react';

import type { Match, SetNumber } from '@/domain/types';
import { MatchPerformance } from '@/features/performance/MatchPerformance';

export interface LivePerformanceProps {
  match: Match;
  /** The set being played: shown first (falls back to all sets until it has a rally). */
  setNumber: SetNumber | undefined;
}

/**
 * v6.1: the performance view inside live mode (the "Performance" tab): a short overview of every
 * player for the set being played, another set or all sets; tap a player for their detail. Its
 * choices are local state, so the live screen's URL and history stay as they are.
 */
export function LivePerformance({ match, setNumber }: LivePerformanceProps) {
  const [setParam, setSetParam] = useState<string>(
    setNumber === undefined ? 'all' : String(setNumber),
  );
  const [player, setPlayer] = useState<string | undefined>(undefined);
  const apply = (next: { set: string; player: string | undefined }) => {
    setSetParam(next.set);
    setPlayer(next.player);
  };
  return (
    <MatchPerformance
      match={match}
      setParam={setParam}
      playerParam={player}
      onParams={apply}
      onOpenPlayer={apply}
    />
  );
}
