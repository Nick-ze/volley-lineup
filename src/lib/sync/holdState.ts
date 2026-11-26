/**
 * v10 audit M1: the live holds this device knows (runtime store) and the matches it has yielded
 * to another scorer. Every change of the known holds goes through `setHolds`, so the engine
 * notices at once when a match this device was scoring is held by another device — from a
 * cycle's hold list or from a refused claim — and stops saving that match (`yieldedNow`).
 */
import { holdStatus, yieldedMatches } from '@/domain/syncAccess';
import type { MatchHold } from '@/domain/types';
import { useSyncRuntime } from '@/store';

import type { EngineCore } from './core';
import { appState } from './storeOps';

/** Replaces the known holds (by match id) and updates the yielded matches. */
export function setHolds(core: EngineCore, holds: Record<string, MatchHold>): void {
  const prev = useSyncRuntime.getState().holds;
  const next = yieldedMatches(
    core.yielded,
    prev,
    holds,
    appState().sync.deviceId,
    core.clock.now(),
  );
  core.yielded.clear();
  for (const matchId of next) core.yielded.add(matchId);
  useSyncRuntime.setState({ holds });
}

/** Adds or replaces one hold. */
export function putHold(core: EngineCore, hold: MatchHold): void {
  setHolds(core, { ...useSyncRuntime.getState().holds, [hold.matchId]: hold });
}

/** Forgets this device's own hold of the match (after its release). */
export function removeOwnHold(core: EngineCore, matchId: string, deviceId: string): void {
  const { [matchId]: hold, ...rest } = useSyncRuntime.getState().holds;
  if (hold?.deviceId === deviceId) setHolds(core, rest);
}

/**
 * The yielded matches another device still holds right now: their records aren't pushed, and
 * the scorer's rows replace this device's unsynced changes to them.
 */
export function yieldedNow(core: EngineCore): Set<string> {
  if (core.yielded.size === 0) return core.yielded;
  const { holds } = useSyncRuntime.getState();
  const deviceId = appState().sync.deviceId;
  const now = core.clock.now();
  return new Set(
    [...core.yielded].filter((id) => holdStatus(holds[id], deviceId, now) === 'other'),
  );
}
