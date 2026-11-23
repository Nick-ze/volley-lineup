import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { selectCurrentProfile, useAppStore } from '@/store';

/**
 * Remembers whether the "jump straight to the last profile's teams" redirect has already
 * been considered in this app session, so the profile picker stays reachable afterwards.
 */
let startupHandled = false;

/** Call from any screen past the picker: from then on, `/` never redirects. */
export function markStartupHandled() {
  startupHandled = true;
}

/** Test helper: start a fresh "app session". */
export function resetStartupRedirect() {
  startupHandled = false;
}

/**
 * On the first visit to the profile picker in an app session, go straight to `/teams`
 * when a valid profile is still selected. Only ever happens once.
 */
export function useStartupRedirect() {
  const router = useRouter();
  const hasProfile = useAppStore((s) => selectCurrentProfile(s) !== undefined);
  useEffect(() => {
    if (startupHandled) return;
    startupHandled = true;
    if (hasProfile) router.replace('/teams');
    // Only the very first run matters (the module-level flag ignores every later one).
  }, [hasProfile, router]);
}
