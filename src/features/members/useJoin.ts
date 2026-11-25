import { useCallback, useState } from 'react';

import { normalizeInviteCode } from '@/domain/invites';
import type { SyncErrorCode, TeamRole } from '@/domain/types';
import { joinTeam, listCloudTeams } from '@/lib/sync';

export interface Joined {
  teamId: string;
  role: TeamRole;
  /** The team's name (from the join result, else the cloud list), when known. */
  name: string | null;
}

export type JoinError = SyncErrorCode | 'format';

/** v10: joins a team with an invite code (or a pasted invite link). */
export function useJoin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<JoinError | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);

  const join = useCallback(async (input: string) => {
    const code = normalizeInviteCode(input);
    if (!code) {
      setError('format');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await joinTeam(code);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    // The join result names the team; without it the cloud team list may (best effort).
    let name = result.value.name;
    if (name === null) {
      const teams = await listCloudTeams();
      name = teams.ok
        ? (teams.value.find((team) => team.teamId === result.value.teamId)?.name ?? null)
        : null;
    }
    setJoined({ ...result.value, name });
    setBusy(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);
  /** Back to the empty form (a new invite link was opened). */
  const reset = useCallback(() => {
    setError(null);
    setJoined(null);
  }, []);
  return { busy, error, joined, join, clearError, reset };
}
