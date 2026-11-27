import { useCallback, useRef, useState } from 'react';

import { normalizeInviteCode } from '@/domain/invites';
import type { SyncErrorCode, TeamRole } from '@/domain/types';
import { downloadTeams, joinTeam, listCloudTeams } from '@/lib/sync';

export interface Joined {
  teamId: string;
  role: TeamRole;
  /** The team's name (from the join result, else the cloud list), when known. */
  name: string | null;
  /**
   * v10 audit M7: this device has an older copy of the team that isn't linked. `asking`: the
   * account is a member, nothing was downloaded, the user is asked; `kept`: they said "not now".
   */
  copy: 'asking' | 'kept' | null;
}

export type JoinError = SyncErrorCode | 'format';

/** v10: joins a team with an invite code (or a pasted invite link). */
export function useJoin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<JoinError | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);
  // A second Enter / tap while a join runs sends nothing (v10 audit L11).
  const running = useRef(false);

  const join = useCallback(async (input: string) => {
    if (running.current) return;
    const code = normalizeInviteCode(input);
    if (!code) {
      setError('format');
      return;
    }
    running.current = true;
    setBusy(true);
    setError(null);
    const result = await joinTeam(code);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      running.current = false;
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
    const { localCopy, ...team } = result.value;
    setJoined({ ...team, name, copy: localCopy ? 'asking' : null });
    setBusy(false);
    running.current = false;
  }, []);

  /** The answer to the question about the older copy: use the cloud's version (download it). */
  const replaceCopy = useCallback(async () => {
    if (running.current || joined?.copy !== 'asking') return;
    running.current = true;
    setBusy(true);
    setError(null);
    const result = await downloadTeams([joined.teamId], [joined.teamId]);
    if (result.ok) setJoined({ ...joined, copy: null });
    else setError(result.error);
    setBusy(false);
    running.current = false;
  }, [joined]);

  /** "Not now": the account stays a member, the copy on this device stays as it is. */
  const keepCopy = useCallback(() => {
    setError(null);
    setJoined((now) => (now?.copy === 'asking' ? { ...now, copy: 'kept' } : now));
  }, []);

  const clearError = useCallback(() => setError(null), []);
  /** Back to the empty form (a new invite link was opened). */
  const reset = useCallback(() => {
    setError(null);
    setJoined(null);
  }, []);
  return { busy, error, joined, join, replaceCopy, keepCopy, clearError, reset };
}
