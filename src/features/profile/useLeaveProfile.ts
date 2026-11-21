import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useAppStore } from '@/store';

/**
 * Log out / switch profile: clear the selection and go to the profile picker. The tab screens
 * are removed from the history (dismiss to the bottom of the stack, then replace it with the
 * picker), so Back can't return into a logged-out tab. With no profile selected the picker
 * never auto-forwards to `/teams` (see `useStartupRedirect`).
 */
export function useLeaveProfile() {
  const router = useRouter();
  return useCallback(() => {
    useAppStore.getState().selectProfile(null);
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  }, [router]);
}
