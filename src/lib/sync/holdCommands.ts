/**
 * v10: live match holds (docs/V10_SYNC_DESIGN.md §3.8). The answer goes into the runtime
 * `holds` at once, so a take-over makes the match editable here (and a refusal read-only)
 * without waiting for the next sync.
 *
 * A granted take-over first pulls the team (v10 QA): the previous scorer's last rallies may have
 * reached the server after this device's last pull, and scoring on the stale copy would save the
 * whole set without them. The match stays read-only here (the other device's hold is still in the
 * runtime holds) until that pull has been tried; offline, the take-over is still granted.
 *
 * A claim that is refused for a match this device was scoring (the 5-minute refresh after
 * someone took over) yields the match at once (`holdState.ts`, audit M1): from then on this
 * device doesn't save it to the cloud while the other device's hold lasts. Taking the match back
 * pulls while it is still yielded, so what the other scorer saved replaces this device's
 * unsynced changes to it before this device scores again.
 *
 * Every hold command (claim, take-over, release) runs through `engine.exclusive`, so they reach
 * the server in the order they were called and never between a sync cycle's steps: a release
 * called while a take-over waits behind a cycle can't overtake it and leave a stale hold.
 */
import { useSyncRuntime } from '@/store';

import type { SyncEngine } from './engine';
import { putHold, removeOwnHold } from './holdState';
import { attempt, requireSession } from './result';
import { appState, displayName } from './storeOps';
import { needsReset, pullTeam } from './teamSync';
import type { SyncResult } from './types';

/**
 * Brings the team up to date before this device scores, like a cycle's pull (a pending reset
 * included). Never fails: offline, this device scores anyway.
 */
async function catchUp(engine: SyncEngine, teamId: string): Promise<void> {
  try {
    const reset = needsReset(engine, teamId);
    const report = await pullTeam(engine, teamId, reset);
    if (reset && report.present) engine.resetPending.delete(teamId);
  } catch {
    // Offline or a server error: the take-over still counts; the next cycle pulls again.
  }
}

async function claim(
  engine: SyncEngine,
  teamId: string,
  matchId: string,
  takeOver: boolean,
): Promise<{ granted: boolean; holder?: string }> {
  const session = requireSession(engine);
  const deviceId = appState().sync.deviceId ?? '';
  const r = await engine.backend.holdMatch(teamId, matchId, deviceId, displayName(), takeOver);
  if (r.granted) {
    if (takeOver) await catchUp(engine, teamId);
    putHold(engine, {
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
  putHold(engine, {
    matchId,
    teamId,
    // The server doesn't say which device: any other than this one makes the match read-only.
    deviceId: known && known.deviceId !== deviceId ? known.deviceId : '',
    userId: known?.userId ?? '',
    holderName: r.holderName,
    heldUntil: r.heldUntil,
  });
  return { granted: false, holder: r.holderName };
}

/**
 * Claims (or, with `takeOver`, takes over) the match's hold, in order with the other hold
 * commands and never during a sync cycle (so no cycle can make the match editable between a
 * take-over's grant and its pull).
 */
export const holdMatch = (
  engine: SyncEngine,
  teamId: string,
  matchId: string,
  takeOver = false,
): Promise<SyncResult<{ granted: boolean; holder?: string }>> =>
  attempt(() => engine.exclusive(() => claim(engine, teamId, matchId, takeOver)));

/** Ends this device's hold (best effort; never fails), after any hold command called before. */
export async function releaseMatch(
  engine: SyncEngine,
  teamId: string,
  matchId: string,
): Promise<void> {
  await attempt(() =>
    engine.exclusive(async () => {
      requireSession(engine);
      const deviceId = appState().sync.deviceId ?? '';
      await engine.backend.releaseMatch(teamId, matchId, deviceId);
      removeOwnHold(engine, matchId, deviceId);
    }),
  );
}
