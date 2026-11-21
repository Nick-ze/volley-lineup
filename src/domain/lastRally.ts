/**
 * The last rally of a set as it was played (docs/PLAN.md §15.3: point tagging). Pure functions,
 * no React, no storage.
 *
 * Tagging names a player who was on court during the rally — before the side-out it may have
 * caused — so the players come from the replay step of that rally, with the libero swap of
 * that moment applied.
 */
import { activeLiberoReplaces, applyLiberoSwaps } from './liberoSwap';
import { replaySteps, type RallyStep } from './liveSet';
import { pointKindsFor } from './pointTags';
import { serverPosition } from './rotation';
import {
  COURT_POSITIONS,
  type Player,
  type PointEvent,
  type PointKind,
  type SetLineup,
  type Side,
} from './types';

export interface LastRally {
  event: PointEvent;
  /** Who served the rally. */
  servingSide: Side;
  /** Our players on court during the rally (libero swap applied), in position order 1–6. */
  playerIds: string[];
  /** Our server of the rally, or null when they served. */
  serverId: string | null;
}

/** The set's last event if it is a rally, with who was on court; null otherwise. */
export function lastRally(set: SetLineup, players: readonly Player[]): LastRally | null {
  const event = set.events[set.events.length - 1];
  if (event === undefined || event.type !== 'point') return null;
  const steps = replaySteps(set, players);
  // The last step belongs to the last event, which is a point.
  const step = steps[steps.length - 1] as RallyStep;
  const serving = step.servingSide === 'us';
  const slots = applyLiberoSwaps(step.slots, set.liberoId, activeLiberoReplaces(set), { serving });
  return {
    event,
    servingSide: step.servingSide,
    playerIds: COURT_POSITIONS.map((p) => slots[p]).filter((id): id is string => id !== null),
    serverId: serving ? slots[serverPosition] : null,
  };
}

/**
 * The tags worth offering for a rally: the winner's kinds, without an ace by the side that
 * didn't serve (our ace only on our serve, their ace only on theirs).
 */
export function plausibleKinds(
  rally: Pick<LastRally, 'event' | 'servingSide'>,
): readonly PointKind[] {
  const impossible: PointKind = rally.servingSide === 'us' ? 'opponentAce' : 'ace';
  return pointKindsFor(rally.event.winner).filter((kind) => kind !== impossible);
}
