import { useEffect } from 'react';

import { followMatch, holdMatch, releaseMatch } from '@/lib/sync';
import { useMatch, useMatchAccess, useTeamAccess } from '@/store';

/** The hold is a 15-minute lease: refresh it well before it runs out (docs/V10_SYNC_DESIGN.md §3.8). */
export const HOLD_REFRESH_MS = 5 * 60 * 1000;

/**
 * v10: while the live screen of a shared team's match is open on a manager device, this device
 * holds the match (advisory, fire-and-forget): claimed on mount, refreshed every 5 minutes and
 * released on unmount. If another device holds it, the claim is simply not granted and the
 * runtime holds make the match read-only here. Local teams never call the backend.
 */
export function useMatchHold(matchId: string | undefined): void {
  const teamId = useMatch(matchId)?.teamId;
  const { shared, canEdit } = useTeamAccess(teamId);
  const claim = shared && canEdit;
  useEffect(() => {
    if (!claim || !teamId || !matchId) return undefined;
    void holdMatch(teamId, matchId);
    const timer = setInterval(() => void holdMatch(teamId, matchId), HOLD_REFRESH_MS);
    return () => {
      clearInterval(timer);
      void releaseMatch(teamId, matchId);
    };
  }, [claim, teamId, matchId]);
}

/**
 * v10: a device that only watches a shared match live (a viewer, or the match is scored on
 * another device) polls it faster while the live screen is open, so the score updates like a
 * ticker. Local teams and the scoring device never follow.
 */
export function useFollowMatch(matchId: string | undefined): void {
  const teamId = useMatch(matchId)?.teamId;
  const { shared } = useTeamAccess(teamId);
  const { canEdit } = useMatchAccess(matchId);
  const follow = shared && !canEdit && !!matchId;
  useEffect(() => {
    if (!follow || !matchId) return undefined;
    followMatch(matchId);
    return () => followMatch(null);
  }, [follow, matchId]);
}
