/**
 * v10 (QA): which status text the badge and the account screens show. Pure.
 *
 * The engine reports phase `off` both when nobody is signed in and when the signed-in account
 * has no shared teams on this device (nothing to sync), and before its first cycle. Only the
 * first is "Not signed in":
 * - signed in (or the stored session still being restored), no shared teams → `noTeams`;
 * - signed in with shared teams, before the first cycle → `syncing` (it starts right away);
 * - no session (signed out, or the session expired) → `off` ("Not signed in").
 */
import type { SyncPhase } from './types';

export type SyncStatusKey = SyncPhase | 'noTeams';

export function syncStatusKey(
  phase: SyncPhase,
  signedIn: boolean,
  sharedTeams: number,
): SyncStatusKey {
  if (phase !== 'off' || !signedIn) return phase;
  return sharedTeams === 0 ? 'noTeams' : 'syncing';
}
