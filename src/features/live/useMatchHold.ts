import { useEffect } from 'react';

import { followMatch, holdMatch, releaseMatch } from '@/lib/sync';
import { useMatch, useMatchAccess, useSession, useTeamAccess } from '@/store';

/** The hold is a 15-minute lease: refresh it well before it runs out (docs/V10_SYNC_DESIGN.md §3.8). */
export const HOLD_REFRESH_MS = 5 * 60 * 1000;

/**
 * Live screens of the same match can be stacked (live → Edit lineup → Live → Back). The hold and
 * the follow belong to the match, not to one screen: they start with the first mounted screen
 * and end with the last one, so popping the top screen never releases what the one below uses.
 */
const holds = new Map<string, { count: number; timer: ReturnType<typeof setInterval> }>();
const follows = new Map<string, number>();

function claimHold(teamId: string, matchId: string): () => void {
  const key = `${teamId}/${matchId}`;
  const held = holds.get(key);
  if (held) held.count += 1;
  else {
    void holdMatch(teamId, matchId);
    const timer = setInterval(() => void holdMatch(teamId, matchId), HOLD_REFRESH_MS);
    holds.set(key, { count: 1, timer });
  }
  return () => {
    const current = holds.get(key);
    if (!current) return;
    current.count -= 1;
    if (current.count > 0) return;
    clearInterval(current.timer);
    holds.delete(key);
    void releaseMatch(teamId, matchId);
  };
}

/** Whether a live screen of the match is open here (it then owns, refreshes and releases the hold). */
export function isHeldByLiveScreen(teamId: string, matchId: string): boolean {
  return holds.has(`${teamId}/${matchId}`);
}

function startFollow(matchId: string): () => void {
  const count = follows.get(matchId) ?? 0;
  follows.set(matchId, count + 1);
  if (count === 0) followMatch(matchId);
  return () => {
    const left = (follows.get(matchId) ?? 1) - 1;
    if (left > 0) {
      follows.set(matchId, left);
      return;
    }
    follows.delete(matchId);
    followMatch(null);
  };
}

/**
 * v10: while the live screen of a shared team's match is open on a manager device, this device
 * holds the match (advisory, fire-and-forget): claimed on mount, refreshed every 5 minutes and
 * released when the last live screen of the match closes. If another device holds it, the claim
 * is simply not granted and the runtime holds make the match read-only here. Local teams never
 * call the backend.
 */
export function useMatchHold(matchId: string | undefined): void {
  const teamId = useMatch(matchId)?.teamId;
  const { shared, canEdit } = useTeamAccess(teamId);
  // The role is persisted, the session is not: on a reload / deep link to live the claim waits
  // until the stored session is restored (a claim without it fails with notSignedIn).
  const userId = useSession()?.userId;
  const claim = shared && canEdit && !!userId;
  useEffect(() => {
    if (!claim || !teamId || !matchId) return undefined;
    return claimHold(teamId, matchId);
  }, [claim, teamId, matchId, userId]);
}

/**
 * v10: a device that only watches a shared match live (a viewer, or the match is scored on
 * another device) polls it faster while a live screen of it is open, so the score updates like a
 * ticker. Local teams and the scoring device never follow. Unlike the hold, this needs no session:
 * the engine keeps the followed match and polls fast once the stored session is restored.
 */
export function useFollowMatch(matchId: string | undefined): void {
  const teamId = useMatch(matchId)?.teamId;
  const { shared } = useTeamAccess(teamId);
  const { canEdit } = useMatchAccess(matchId);
  const follow = shared && !canEdit && !!matchId;
  useEffect(() => {
    if (!follow || !matchId) return undefined;
    return startFollow(matchId);
  }, [follow, matchId]);
}
