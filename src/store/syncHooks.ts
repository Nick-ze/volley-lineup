/**
 * v10: hooks for the sync state. Screens and features use these (never `@/lib/sync` internals or
 * supabase-js) to show the status, the account and whether a team / match may be edited.
 */
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  heldMatchIds,
  matchAccess,
  teamAccess,
  type MatchAccess,
  type TeamAccess,
} from '@/domain/syncAccess';
import type { MatchHold, SyncAccount, SyncNotice, SyncStatus } from '@/domain/types';

import { useAppStore } from './appStore';
import { useSyncRuntime, type SyncSession } from './syncRuntime';

export const useSyncStatus = (): SyncStatus => useSyncRuntime((s) => s.status);

export const useSession = (): SyncSession | null => useSyncRuntime((s) => s.session);

/** True while the stored session is being restored (see `SyncRuntimeState.restoring`). */
export const useSessionRestoring = (): boolean => useSyncRuntime((s) => s.restoring);

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

/**
 * The matches among `matchIds` that another device is scoring live right now, with that device's
 * hold (v10 audit M15): they — and with them their season, their team for everyone, and players
 * in their lineups — can't be deleted here meanwhile. Re-renders when the next hold runs out.
 */
export function useHeldMatches(matchIds: readonly string[]): ReadonlyMap<string, MatchHold> {
  const holds = useSyncRuntime((s) => s.holds);
  const deviceId = useAppStore((s) => s.sync.deviceId);
  const [now, setNow] = useState(() => Date.now());
  // The next end of another device's hold on one of these matches: the time is read again then.
  const nextEnd = matchIds
    .flatMap((id) => (holds[id] && holds[id].deviceId !== deviceId ? [holds[id].heldUntil] : []))
    .sort()
    .find((end) => Date.parse(end) > now);
  useEffect(() => {
    if (!nextEnd) return undefined;
    const ms = Math.max(0, Date.parse(nextEnd) - Date.now());
    const timer = setTimeout(() => setNow(Date.now()), ms + 50);
    return () => clearTimeout(timer);
  }, [nextEnd]);
  return new Map(heldMatchIds(holds, deviceId, now, matchIds).map((id) => [id, holds[id]]));
}

/**
 * Whether this device may edit the team right now, read from the store at the moment of the call
 * (v10 audit L18): for the action of a dialog that may have been open while the role changed.
 */
export const canEditTeamNow = (teamId: string | null | undefined): boolean =>
  teamAccess(useAppStore.getState().sync, teamId ?? '').canEdit;

/** The matches among `matchIds` another device is scoring live at this moment (see the hook). */
export function heldMatchesNow(matchIds: readonly string[]): string[] {
  const { holds } = useSyncRuntime.getState();
  return heldMatchIds(holds, useAppStore.getState().sync.deviceId, Date.now(), matchIds);
}

/**
 * Whether this device may change or delete the match right now: the team's role, and no other
 * device scoring the match live (v10 audit M15, L18). For the action of a confirm dialog.
 */
export function canEditMatchNow(matchId: string): boolean {
  const match = useAppStore.getState().matches.find((m) => m.id === matchId);
  return (
    match !== undefined && canEditTeamNow(match.teamId) && heldMatchesNow([matchId]).length === 0
  );
}
