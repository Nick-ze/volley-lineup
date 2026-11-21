/**
 * The last rally of a set as it was played (docs/PLAN.md §15.3: point tagging). Pure functions,
 * no React, no storage.
 *
 * Tagging names a player who was on court during the rally — before the side-out it may have
 * caused — so the players come from the replay step of that rally, with the libero swap of
 * that moment applied. The player picker only offers who could plausibly have done it
 * (docs/VOLLEYBALL_RULES.md §6 check #35): a block needs a front-row player, never the libero
 * (FIVB 14.6.2, 19.3.1.3); an ace is our server of that rally; a kill is anyone on court but the
 * libero (FIVB 19.3.1.2: no attack above the net); our error can be anyone on court.
 */
import { applyLiberoSwaps } from './liberoSwap';
import { replaySteps, type RallyStep } from './liveSet';
import { pointKindsFor } from './pointTags';
import { FRONT_ROW_POSITIONS, serverPosition } from './rotation';
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
  /** Our front-row players (positions 2, 3, 4) during the rally, in position order. */
  frontRowIds: string[];
  /** The set's libero (whether on court or not), or null. */
  liberoId: string | null;
}

/** The set's last event if it is a rally, with who was on court; null otherwise. */
export function lastRally(set: SetLineup, players: readonly Player[]): LastRally | null {
  const event = set.events[set.events.length - 1];
  if (event === undefined || event.type !== 'point') return null;
  const steps = replaySteps(set, players);
  // The last step belongs to the last event, which is a point.
  const step = steps[steps.length - 1] as RallyStep;
  const serving = step.servingSide === 'us';
  const slots = applyLiberoSwaps(step.slots, set.liberoId, step.liberoReplaces, { serving });
  return {
    event,
    servingSide: step.servingSide,
    playerIds: COURT_POSITIONS.map((p) => slots[p]).filter((id): id is string => id !== null),
    serverId: serving ? slots[serverPosition] : null,
    frontRowIds: FRONT_ROW_POSITIONS.map((p) => slots[p]).filter((id): id is string => id !== null),
    liberoId: set.liberoId,
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

/**
 * The players worth offering for a tag of `kind` on the rally (position order): block = front
 * row without the libero, ace = our server, kill = on court without the libero, our error =
 * anyone on court; none for a kind that names no player. A player already tagged with this kind
 * stays in the list (so an older, implausible tag can still be cleared).
 */
export function plausiblePlayerIds(
  rally: Pick<LastRally, 'event' | 'playerIds' | 'serverId' | 'frontRowIds' | 'liberoId'>,
  kind: PointKind,
): string[] {
  const notLibero = (id: string) => id !== rally.liberoId;
  let ids: string[];
  if (kind === 'block') ids = rally.frontRowIds.filter(notLibero);
  else if (kind === 'ace') ids = rally.serverId === null ? [] : [rally.serverId];
  else if (kind === 'kill') ids = rally.playerIds.filter(notLibero);
  else if (kind === 'ourError') ids = [...rally.playerIds];
  else ids = [];
  const tagged = rally.event.kind === kind ? rally.event.playerId : undefined;
  if (tagged !== undefined && !ids.includes(tagged)) ids.push(tagged);
  return ids;
}
