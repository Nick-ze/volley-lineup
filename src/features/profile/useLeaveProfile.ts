import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { signOut } from '@/lib/sync';
import { useAppStore } from '@/store';

import { isLinkedProfile } from './deleteProfileSignedOut';

/**
 * Log out / switch profile: clear the selection and go to the profile picker. The tab screens
 * are removed from the history (dismiss to the bottom of the stack, then replace it with the
 * picker), so Back can't return into a logged-out tab. With no profile selected the picker
 * never auto-forwards to `/teams` (see `useStartupRedirect`).
 *
 * v10: leaving the profile the account is linked to also signs out on this device (the link and
 * pending changes stay, so signing in again resumes sync).
 */
export function useLeaveProfile() {
  const router = useRouter();
  return useCallback(() => {
    const { currentProfileId, selectProfile } = useAppStore.getState();
    if (currentProfileId && isLinkedProfile(currentProfileId)) void signOut();
    selectProfile(null);
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }, [router]);
}
