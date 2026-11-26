import { useMemo } from 'react';

import { accountLink, type AccountLink } from '@/domain/syncSetup';
import { useAppStore, useSession, useSessionRestoring, useSyncAccount } from '@/store';

/**
 * v10: whether the current profile is the one signed in (or the account is another profile's, or
 * its stored session is still being read at start: audit M14).
 */
export function useAccountLink(): AccountLink {
  const session = useSession();
  const account = useSyncAccount();
  const profileId = useAppStore((s) => s.currentProfileId);
  const profiles = useAppStore((s) => s.profiles);
  const restoring = useSessionRestoring();
  return useMemo(
    () => accountLink(session, account, profileId, profiles, restoring),
    [session, account, profileId, profiles, restoring],
  );
}
