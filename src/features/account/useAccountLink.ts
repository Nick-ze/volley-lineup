import { useMemo } from 'react';

import { accountLink, type AccountLink } from '@/domain/syncSetup';
import { useAppStore, useSession, useSyncAccount } from '@/store';

/** v10: whether the current profile is the one signed in (or the account is another profile's). */
export function useAccountLink(): AccountLink {
  const session = useSession();
  const account = useSyncAccount();
  const profileId = useAppStore((s) => s.currentProfileId);
  const profiles = useAppStore((s) => s.profiles);
  return useMemo(
    () => accountLink(session, account, profileId, profiles),
    [session, account, profileId, profiles],
  );
}
