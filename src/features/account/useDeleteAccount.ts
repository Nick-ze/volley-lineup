import { useState } from 'react';

import type { SyncErrorCode } from '@/domain/types';
import { accountDeletionCheck, deleteAccount, listCloudTeams } from '@/lib/sync';
import { useAppStore } from '@/store';

export interface NamedTeam {
  id: string;
  /** null: not on this device and no name in the cloud list either. */
  name: string | null;
  /** On this device (so its Members screen can open). */
  local: boolean;
}

/** Names for team ids: the local copy's, else the cloud list's (fetched only when needed). */
async function nameTeams(ids: string[]): Promise<NamedTeam[]> {
  const local = new Map(useAppStore.getState().teams.map((t) => [t.id, t.name]));
  let cloud = new Map<string, string>();
  if (ids.some((id) => !local.has(id))) {
    const result = await listCloudTeams();
    if (result.ok) cloud = new Map(result.value.map((c) => [c.teamId, c.name]));
  }
  return ids.map((id) => ({
    id,
    // v10 audit L22: a cloud team without its team record yet has an empty name.
    name: local.get(id) || cloud.get(id) || null,
    local: local.has(id),
  }));
}

/**
 * v10: Delete account (amendment 1 of docs/V10_SYNC_DESIGN.md): check first — blocked while the
 * user is the last manager of a team with other members — then confirm (naming the sole-member
 * teams that are deleted for good), then `deleteAccount()`. Local data always stays.
 */
export function useDeleteAccount(onDeleted: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SyncErrorCode | null>(null);
  const [blocked, setBlocked] = useState<NamedTeam[]>([]);
  const [confirming, setConfirming] = useState<NamedTeam[] | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    setBlocked([]);
    const check = await accountDeletionCheck();
    if (!check.ok) {
      setBusy(false);
      setError(check.error);
      return;
    }
    const { blockedTeams, deleteTeams } = check.value;
    const named = await nameTeams(blockedTeams.length > 0 ? blockedTeams : deleteTeams);
    setBusy(false);
    if (blockedTeams.length > 0) setBlocked(named);
    else setConfirming(named);
  };

  const confirm = async () => {
    setConfirming(null);
    setBusy(true);
    const result = await deleteAccount();
    setBusy(false);
    if (result.ok) onDeleted();
    else setError(result.error);
  };

  return { busy, error, blocked, confirming, start, confirm, cancel: () => setConfirming(null) };
}
