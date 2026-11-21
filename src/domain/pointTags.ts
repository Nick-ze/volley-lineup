/**
 * Optional point tags (docs/PLAN.md §15.3, §16). Pure functions, no React, no storage.
 *
 * A tag says what decided a rally. Kinds belong to the side that won it; only some kinds name a
 * player of our team (who scored the kill / ace / block, or who made the error).
 */
import type { PointEvent, PointKind, SetLineup, Side } from './types';

/** Tags for a rally we won, in display order. */
export const US_POINT_KINDS: readonly PointKind[] = ['kill', 'ace', 'block', 'opponentError'];
/** Tags for a rally they won, in display order. */
export const THEM_POINT_KINDS: readonly PointKind[] = ['ourError', 'opponentKill', 'opponentAce'];

const PLAYER_KINDS: ReadonlySet<PointKind> = new Set<PointKind>([
  'kill',
  'ace',
  'block',
  'ourError',
]);

/** The tags offered after a rally won by `winner`. */
export function pointKindsFor(winner: Side): readonly PointKind[] {
  return winner === 'us' ? US_POINT_KINDS : THEM_POINT_KINDS;
}

/** True when a tag of this kind can name one of our players. */
export function kindTakesPlayer(kind: PointKind): boolean {
  return PLAYER_KINDS.has(kind);
}

/**
 * True when a point's tag is coherent: no tag at all, or a kind of the winning side, and a
 * player only on a kind that takes one (a player without a kind is invalid).
 */
export function isValidPointTag(event: Pick<PointEvent, 'winner' | 'kind' | 'playerId'>): boolean {
  if (event.kind === undefined) return event.playerId === undefined;
  if (!pointKindsFor(event.winner).includes(event.kind)) return false;
  return event.playerId === undefined || kindTakesPlayer(event.kind);
}

/** A point without its tag (keeps winner and timestamp). */
function untagged(event: PointEvent): PointEvent {
  const { kind: _kind, playerId: _playerId, ...rest } = event;
  return rest;
}

/**
 * A new set where the last event — if it is a point — carries the given tag. `kind: null` clears
 * the tag. An invalid tag (kind of the other side, player on a kind without one) or a set whose
 * last event isn't a point returns the set unchanged.
 */
export function tagLastPoint(
  set: SetLineup,
  kind: PointKind | null,
  playerId: string | null = null,
): SetLineup {
  const last = set.events[set.events.length - 1];
  if (last === undefined || last.type !== 'point') return set;
  const base = untagged(last);
  const next: PointEvent =
    kind === null ? base : { ...base, kind, ...(playerId === null ? {} : { playerId }) };
  if (!isValidPointTag(next)) return set;
  return { ...set, events: [...set.events.slice(0, -1), next] };
}
