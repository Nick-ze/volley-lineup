import { getMatchState } from '@/domain/matchState';
import type { Match } from '@/domain/types';
import type { Strings } from '@/i18n';

/**
 * The match result as a short label: "3:1 won", "1:3 lost", "2:1 · in progress" (or just
 * "in progress" before a set is decided), null when no rally has been played.
 */
export function matchResultLabel(t: Strings, match: Pick<Match, 'sets'>): string | null {
  const { status, setsWon } = getMatchState(match);
  const { us, them } = setsWon;
  switch (status) {
    case 'notStarted':
      return null;
    case 'won':
      return t.match.resultWon(us, them);
    case 'lost':
      return t.match.resultLost(us, them);
    case 'inProgress':
      return us + them > 0 ? t.match.resultInProgressSets(us, them) : t.match.resultInProgress;
  }
}
