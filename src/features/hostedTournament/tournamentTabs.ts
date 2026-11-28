import { parseTab } from '@/lib/parseTab';

/** The sections of the tournament screen (`?tab=…`), in tab order. */
export const TOURNAMENT_TABS = ['table', 'matches', 'teams'] as const;
export type TournamentTab = (typeof TOURNAMENT_TABS)[number];

/** Fewer than two teams: there is no plan yet, so the screen opens where teams are entered. */
export const defaultTournamentTab = (teamCount: number): TournamentTab =>
  teamCount < 2 ? 'teams' : 'matches';

/** Parses `?tab=`; anything unknown (or missing) is `fallback`. */
export const parseTournamentTab = (
  value: string | string[] | undefined,
  fallback: TournamentTab,
): TournamentTab => parseTab(TOURNAMENT_TABS, value, fallback);
