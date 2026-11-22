/** v7.0: which season the team's Stats tab shows first (docs/PLAN.md §28.4). Pure. */
import { getMatchState } from './matchState';
import type { Match, Season } from './types';

/**
 * The season the Stats tab opens with: the newest season with a played match (one with a
 * rally, as in `seasonOverview`), else null (All seasons). `seasons` must be newest first.
 */
export function defaultStatsSeasonId(
  seasons: readonly Season[],
  matches: readonly Pick<Match, 'seasonId' | 'sets'>[],
): string | null {
  const played = new Set(
    matches.filter((m) => getMatchState(m).status !== 'notStarted').map((m) => m.seasonId),
  );
  return seasons.find((s) => played.has(s.id))?.id ?? null;
}
