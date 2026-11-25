import { useCallback, useState } from 'react';

import { useT } from '@/i18n';
import { deleteTeamEverywhere, leaveTeam, unlinkTeam, type SyncResult } from '@/lib/sync';
import { useAppStore } from '@/store';

import { teamCommandErrorText } from './syncErrorText';

/** Removes the team from this device and stops syncing it (the cloud copy is untouched). */
function removeLocally(teamId: string): void {
  useAppStore.getState().deleteTeam(teamId);
  unlinkTeam(teamId);
}

/**
 * v10 (design §3.11): the actions of the shared-team delete dialog. "Remove from this device"
 * works offline; "Delete for everyone" and "Leave team" need the server first, and only on
 * success is the local copy removed too. A failure keeps the dialog open with its reason.
 */
export function useSharedTeamDelete(teamId: string, onDone: () => void) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (command: (id: string) => Promise<SyncResult>) => {
      setBusy(true);
      setError(null);
      const result = await command(teamId);
      if (result.ok) {
        removeLocally(teamId);
        onDone();
        return;
      }
      setBusy(false);
      setError(teamCommandErrorText(t, result.error));
    },
    [teamId, onDone, t],
  );

  return {
    busy,
    error,
    removeHere: () => {
      removeLocally(teamId);
      onDone();
    },
    deleteEverywhere: () => run(deleteTeamEverywhere),
    leave: () => run(leaveTeam),
  };
}
