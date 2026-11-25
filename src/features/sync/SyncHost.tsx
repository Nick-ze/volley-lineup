import { useEffect } from 'react';

import { startSync } from '@/lib/sync';

/**
 * v10: starts background sync once the store has loaded (mounted in `app/_layout.tsx`). Renders
 * nothing; without an account or shared teams the engine makes no network calls.
 */
export function SyncHost() {
  useEffect(() => startSync(), []);
  return null;
}
