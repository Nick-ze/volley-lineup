import { useCallback, useEffect, useRef, useState } from 'react';

import { activeInvites, sortMembers } from '@/domain/invites';
import type { SyncErrorCode, TeamRole } from '@/domain/types';
import { listInvites, listMembers, type Invite, type Member, type SyncResult } from '@/lib/sync';

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

/** v10: the members (and, for managers, the invites) of a shared team, with actions. */
export function useMembers(teamId: string, cachedRole: TeamRole | null): MembersState {
  const [lists, setLists] = useState<Lists>({ members: null, invites: null, error: null });
  const [actionError, setActionError] = useState<SyncErrorCode | null>(null);
  const [busy, setBusy] = useState(true);
  const mounted = useRef(true);

  const apply = useCallback((next: Lists) => {
    if (!mounted.current) return;
    setLists(next);
    setBusy(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void fetchLists(teamId, cachedRole).then(apply);
    return () => {
      mounted.current = false;
    };
  }, [teamId, cachedRole, apply]);

  const reload = useCallback(async () => {
    setBusy(true);
    apply(await fetchLists(teamId, cachedRole));
  }, [teamId, cachedRole, apply]);

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

  const myRole = lists.members?.find((m) => m.isMe)?.role ?? cachedRole;
  return {
    members: lists.members,
    invites: lists.invites,
    myRole,
    loadError: lists.error,
    actionError,
    busy,
    reload,
    run,
  };
}
