import { useCallback, useEffect, useMemo, useState } from 'react';

import { setupLists } from '@/domain/syncSetup';
import type { SyncErrorCode } from '@/domain/types';
import { listCloudTeams, type CloudTeam, type SyncResult } from '@/lib/sync';
import { useAppStore, useSharedTeamIds, useTeamsForProfile } from '@/store';

/**
 * v10: the Cloud teams pickers' data: this profile's unshared teams (upload) and the account's
 * cloud teams that aren't on this device (download, loaded from the server).
 */
export function useCloudTeams() {
  const profileId = useAppStore((s) => s.currentProfileId);
  const localTeams = useTeamsForProfile(profileId);
  const linkedIds = useSharedTeamIds();
  const [cloud, setCloud] = useState<CloudTeam[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SyncErrorCode | null>(null);

  const apply = useCallback((result: SyncResult<CloudTeam[]>) => {
    setLoading(false);
    if (result.ok) {
      setCloud(result.value);
      setError(null);
    } else setError(result.error);
  }, []);

  useEffect(() => {
    let live = true;
    void listCloudTeams().then((result) => {
      if (live) apply(result);
    });
    return () => {
      live = false;
    };
  }, [apply]);

  const reload = useCallback(async () => {
    setLoading(true);
    apply(await listCloudTeams());
  }, [apply]);

  const lists = useMemo(
    () => setupLists(localTeams, linkedIds, cloud ?? []),
    [localTeams, linkedIds, cloud],
  );
  return { ...lists, loading, error, reload };
}
