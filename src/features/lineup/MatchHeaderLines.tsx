import { MatchResultLine } from '@/features/live/MatchResultLine';
import { MatchSeasonLine } from '@/features/matchForm/MatchSeasonLine';
import { useMatch } from '@/store';

/**
 * v11: the two quiet lines under the match screen's title — the season the match belongs to and
 * its result so far. They read the match themselves, so the header's options don't change with
 * every edit of the lineup.
 */
export function MatchHeaderLines({ matchId }: { matchId: string }) {
  const match = useMatch(matchId);
  if (!match) return null;
  return (
    <>
      <MatchSeasonLine match={match} />
      <MatchResultLine match={match} />
    </>
  );
}
