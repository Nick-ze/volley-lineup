import { useMemo } from 'react';

import { tournamentPlan, type TournamentPlan } from '@/domain/hostedTournament';
import type { HostedTournament } from '@/domain/types';
import { useHostedResults, useHostedTeams } from '@/store';

/** The tournament's plan with its results (recomputed only when teams, results or settings change). */
export function useTournamentPlan(tournament: HostedTournament): TournamentPlan {
  const teams = useHostedTeams(tournament.id);
  const results = useHostedResults(tournament.id);
  const { id, setsPerMatch, matchEnd } = tournament;
  return useMemo(
    () => tournamentPlan({ id, setsPerMatch, matchEnd }, teams, results),
    [id, setsPerMatch, matchEnd, teams, results],
  );
}
