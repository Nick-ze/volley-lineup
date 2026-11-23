/**
 * Season lists (a team's seasons, a season's opponents) and the record against each opponent.
 *
 * Part of the `seasons.ts` barrel: import sibling modules directly, never the barrel.
 */
import { getMatchState } from './matchState';
import type { Match, Opponent, Season } from './types';

/** A team's seasons, newest first (start date, else creation time), then by name. */
export function seasonsForTeam(seasons: readonly Season[], teamId: string): Season[] {
  const key = (s: Season) => s.startDate ?? s.createdAt.slice(0, 10);
  return seasons
    .filter((s) => s.teamId === teamId)
    .sort((a, b) => key(b).localeCompare(key(a)) || a.name.localeCompare(b.name));
}

/** A season's opponents, by name. */
export function opponentsForSeason(opponents: readonly Opponent[], seasonId: string): Opponent[] {
  return opponents
    .filter((o) => o.seasonId === seasonId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True when an opponent has matches (it can't be deleted then). */
export function opponentHasMatches(matches: readonly Match[], opponentId: string): boolean {
  return matches.some((m) => m.opponentId === opponentId);
}

export interface OpponentRecord {
  opponent: Opponent;
  /** Matches with at least one rally. */
  played: number;
  won: number;
  lost: number;
  inProgress: number;
  /** Matches not started yet. */
  upcoming: number;
  setsWon: number;
  setsLost: number;
}

/**
 * The season's record against each of its opponents (every opponent listed, also without
 * matches), in name order. Results are derived as everywhere (`getMatchState`).
 */
export function opponentRecords(
  opponents: readonly Opponent[],
  matches: readonly Match[],
  seasonId: string,
): OpponentRecord[] {
  return opponentsForSeason(opponents, seasonId).map((opponent) => {
    const record: OpponentRecord = {
      opponent,
      played: 0,
      won: 0,
      lost: 0,
      inProgress: 0,
      upcoming: 0,
      setsWon: 0,
      setsLost: 0,
    };
    for (const match of matches) {
      if (match.opponentId !== opponent.id) continue;
      const state = getMatchState(match);
      if (state.status === 'notStarted') {
        record.upcoming += 1;
        continue;
      }
      record.played += 1;
      if (state.status === 'won') record.won += 1;
      else if (state.status === 'lost') record.lost += 1;
      else record.inProgress += 1;
      record.setsWon += state.setsWon.us;
      record.setsLost += state.setsWon.them;
    }
    return record;
  });
}
