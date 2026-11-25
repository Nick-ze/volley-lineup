import { useCallback, useEffect, useRef, useState } from 'react';

import { activeInvites, sortMembers } from '@/domain/invites';
import type { SyncErrorCode, TeamRole } from '@/domain/types';
import { listInvites, listMembers, type Invite, type Member, type SyncResult } from '@/lib/sync';
import { useSession, useSessionRestoring, useSyncStatus } from '@/store';

interface Lists {
  members: Member[] | null;
  invites: Invite[] | null;
  error: SyncErrorCode | null;
}

/** Loads the members and, for managers, the invites (RLS hides invites from players). */
async function fetchLists(teamId: string, cachedRole: TeamRole | null): Promise<Lists> {
  const listed = await listMembers(teamId);
  if (!listed.ok) return { members: null, invites: null, error: listed.error };
  const role = listed.value.find((m) => m.isMe)?.role ?? cachedRole;
  const invited = role === 'manager' ? await listInvites(teamId) : null;
  return {
    members: sortMembers(listed.value),
    invites: invited?.ok ? activeInvites(invited.value, Date.now()) : null,
    error: invited && !invited.ok ? invited.error : null,
  };
}

export interface MembersState {
  /** Sorted (managers first); null while loading or after a load error. */
  members: Member[] | null;
  /**
   * Managers only: the invites that still work when loaded, soonest expiry first; null for
   * players, while loading or after a load error.
   */
  invites: Invite[] | null;
  /** This user's role: from the member list once loaded, else the role cached on the device. */
  myRole: TeamRole | null;
  /** Loading the members (or a manager's invites) failed. */
  loadError: SyncErrorCode | null;
  /** The last action failed. */
  actionError: SyncErrorCode | null;
  /** An action or a load is running: the buttons are disabled. */
  busy: boolean;
  reload: () => Promise<void>;
  /**
   * Runs a sync command. On success it reloads the lists (unless `reloadAfter` is false) and
   * resolves true; otherwise it shows the error and resolves false.
   */
  run: (command: () => Promise<SyncResult<unknown>>, reloadAfter?: boolean) => Promise<boolean>;
}

/**
 * v10: the members (and, for managers, the invites) of a shared team, with actions. Loads again
 * when the session changes; while the stored session is still being restored (the screen opened
 * first after a reload) it stays loading instead of saying "Sign in first" (offline: offline).
 */
export function useMembers(teamId: string, cachedRole: TeamRole | null): MembersState {
  const userId = useSession()?.userId;
  const waiting = useSessionRestoring() && !userId;
  const offline = useSyncStatus().phase === 'offline';
  // What the lists were loaded for: a new session (or team / role) loads them again.
  const key = `${teamId}|${cachedRole ?? ''}|${userId ?? ''}`;
  const [lists, setLists] = useState<Lists & { key: string | null }>({
    members: null,
    invites: null,
    error: null,
    key: null,
  });
  const [actionError, setActionError] = useState<SyncErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const next = await fetchLists(teamId, cachedRole);
    return { ...next, key };
  }, [teamId, cachedRole, key]);

  useEffect(() => {
    if (waiting) return undefined;
    // A load started for an earlier session must not overwrite this one's.
    let current = true;
    void load().then((next) => {
      if (current && mounted.current) setLists(next);
    });
    return () => {
      current = false;
    };
  }, [load, waiting]);

  const reload = useCallback(async () => {
    setBusy(true);
    const next = await load();
    if (!mounted.current) return;
    setLists(next);
    setBusy(false);
  }, [load]);

  const run = useCallback(
    async (command: () => Promise<SyncResult<unknown>>, reloadAfter = true) => {
      setBusy(true);
      setActionError(null);
      const result = await command();
      if (!mounted.current) return result.ok;
      if (!result.ok) {
        setActionError(result.error);
        setBusy(false);
        return false;
      }
      if (reloadAfter) await reload();
      else setBusy(false);
      return true;
    },
    [reload],
  );

  const loaded = lists.key === key;
  const myRole = lists.members?.find((m) => m.isMe)?.role ?? cachedRole;
  return {
    members: lists.members,
    invites: lists.invites,
    myRole,
    loadError: waiting ? (offline ? 'offline' : null) : loaded ? lists.error : null,
    actionError,
    busy: busy || (waiting ? !offline : !loaded),
    reload,
    run,
  };
}
