/**
 * v10: live match holds (docs/V10_SYNC_DESIGN.md §3.8). The answer goes into the runtime
 * `holds` at once, so a take-over makes the match editable here (and a refusal read-only)
 * without waiting for the next sync.
 */
import type { MatchHold } from '@/domain/types';
import { useSyncRuntime } from '@/store';

import type { SyncEngine } from './engine';
import { attempt, requireSession } from './result';
import { appState, displayName } from './storeOps';
import type { SyncResult } from './types';

function putHold(hold: MatchHold): void {
  useSyncRuntime.setState((r) => ({ holds: { ...r.holds, [hold.matchId]: hold } }));
}

export const holdMatch = (
  engine: SyncEngine,
  teamId: string,
  matchId: string,
  takeOver = false,
): Promise<SyncResult<{ granted: boolean; holder?: string }>> =>
  attempt(async () => {
    const session = requireSession(engine);
    const deviceId = appState().sync.deviceId ?? '';
    const r = await engine.backend.holdMatch(teamId, matchId, deviceId, displayName(), takeOver);
    if (r.granted) {
      putHold({
        matchId,
        teamId,
        deviceId,
        userId: session.userId,
        holderName: r.holderName,
        heldUntil: r.heldUntil,
      });
      return { granted: true };
    }
    const known = useSyncRuntime.getState().holds[matchId];
    putHold({
      matchId,
      teamId,
      // The server doesn't say which device: any other than this one makes the match read-only.
      deviceId: known && known.deviceId !== deviceId ? known.deviceId : '',
      userId: known?.userId ?? '',
      holderName: r.holderName,
      heldUntil: r.heldUntil,
    });
    return { granted: false, holder: r.holderName };
  });

/** Ends this device's hold (best effort; never fails). */
export async function releaseMatch(
  engine: SyncEngine,
  teamId: string,
  matchId: string,
): Promise<void> {
  const deviceId = appState().sync.deviceId ?? '';
  const released = await attempt(async () => {
    requireSession(engine);
    await engine.backend.releaseMatch(teamId, matchId, deviceId);
  });
  if (!released.ok) return;
  useSyncRuntime.setState((r) => {
    if (r.holds[matchId]?.deviceId !== deviceId) return r;
    const { [matchId]: _released, ...holds } = r.holds;
    return { holds };
  });
}
