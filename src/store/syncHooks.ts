/**
 * v10: hooks for the sync state. Screens and features use these (never `@/lib/sync` internals or
 * supabase-js) to show the status, the account and whether a team / match may be edited.
 */
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { matchAccess, teamAccess, type MatchAccess, type TeamAccess } from '@/domain/syncAccess';
import type { SyncAccount, SyncNotice, SyncStatus } from '@/domain/types';

import { useAppStore } from './appStore';
import { useSyncRuntime, type SyncSession } from './syncRuntime';

export const useSyncStatus = (): SyncStatus => useSyncRuntime((s) => s.status);

export const useSession = (): SyncSession | null => useSyncRuntime((s) => s.session);

export const useSyncAccount = (): SyncAccount | null => useAppStore((s) => s.sync.account);

export const useSyncNotices = (): SyncNotice[] => useSyncRuntime((s) => s.notices);

/** Ids of the teams shared through the cloud on this device. */
export const useSharedTeamIds = (): string[] =>
  useAppStore(useShallow((s) => Object.keys(s.sync.teams)));

/** Whether the team is shared and this device may edit it (local teams: always). */
export function useTeamAccess(teamId: string | null | undefined): TeamAccess {
  // Select the role only, so screens don't re-render when the team's bookkeeping changes.
  const role = useAppStore((s) => (teamId ? s.sync.teams[teamId]?.role : undefined));
  const teams = role && teamId ? { [teamId]: { ...ROLE_ONLY, role } } : {};
  return teamAccess({ deviceId: null, account: null, teams }, teamId ?? '');
}

const ROLE_ONLY = { userId: '', cursor: 0, base: {}, edits: {}, photos: [] };

export const useCanEdit = (teamId: string | null | undefined): boolean =>
  useTeamAccess(teamId).canEdit;

/**
 * The time to judge a hold by: set at mount and again just after `until` (a hold's end), so a
 * held match becomes editable on its own when the hold runs out.
 */
function useNowUntil(until: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const ms = Math.max(0, Date.parse(until) - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), ms + 50);
    return () => clearTimeout(timer);
  }, [until]);
  return now;
}

/** Whether this device may edit the match (viewer role, or another device scoring it live). */
export function useMatchAccess(matchId: string | null | undefined): MatchAccess {
  const teamId = useAppStore((s) => s.matches.find((m) => m.id === matchId)?.teamId);
  const role = useAppStore((s) => (teamId ? s.sync.teams[teamId]?.role : undefined));
  const deviceId = useAppStore((s) => s.sync.deviceId);
  const hold = useSyncRuntime((s) => (matchId ? s.holds[matchId] : undefined));
  const now = useNowUntil(hold?.heldUntil);
  if (!teamId) return { canEdit: true, block: null };
  const teams = role ? { [teamId]: { ...ROLE_ONLY, role } } : {};
  return matchAccess({ deviceId, account: null, teams }, teamId, hold, now);
}
