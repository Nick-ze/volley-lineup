/**
 * Optional point tags (docs/PLAN.md §15.3, §16). Pure functions, no React, no storage.
 *
 * A tag says what decided a rally. Kinds belong to the side that won it; only some kinds name a
 * player of our team (who scored the kill / ace / block, or who made the error).
 */
import {
  ERROR_TYPES,
  type ErrorType,
  type PointEvent,
  type PointKind,
  type SetLineup,
  type Side,
} from './types';

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

/** v7: true when a tag of this kind can carry an error type (only "our error"). */
export function kindTakesErrorType(kind: PointKind): boolean {
  return kind === 'ourError';
}

/**
 * True when a point's tag is coherent: no tag at all, or a kind of the winning side, a player
 * only on a kind that takes one (a player without a kind is invalid), and (v7) an error type
 * only on "our error" and only one of `ERROR_TYPES`.
 */
export function isValidPointTag(
  event: Pick<PointEvent, 'winner' | 'kind' | 'playerId' | 'errorType'>,
): boolean {
  if (event.kind === undefined)
    return event.playerId === undefined && event.errorType === undefined;
  if (!pointKindsFor(event.winner).includes(event.kind)) return false;
  if (event.errorType !== undefined) {
    if (!kindTakesErrorType(event.kind) || !ERROR_TYPES.includes(event.errorType)) return false;
  }
  return event.playerId === undefined || kindTakesPlayer(event.kind);
}

/** A point without its tag (keeps winner and timestamp). */
function untagged(event: PointEvent): PointEvent {
  const { kind: _kind, playerId: _playerId, errorType: _errorType, ...rest } = event;
  return rest;
}

function replaceLast(set: SetLineup, next: PointEvent): SetLineup {
  return { ...set, events: [...set.events.slice(0, -1), next] };
}

/**
 * A new set where the last event — if it is a point — carries the given tag. `kind: null` clears
 * the tag. An invalid tag (kind of the other side, player on a kind without one) or a set whose
 * last event isn't a point returns the set unchanged. v7: re-tagging "our error" (e.g. to pick
 * the player) keeps its error type; any other kind drops it.
 */
export function tagLastPoint(
  set: SetLineup,
  kind: PointKind | null,
  playerId: string | null = null,
): SetLineup {
  const last = set.events[set.events.length - 1];
  if (last === undefined || last.type !== 'point') return set;
  const base = untagged(last);
  const keepType =
    kind !== null && kind === last.kind && last.errorType !== undefined
      ? { errorType: last.errorType }
      : {};
  const next: PointEvent =
    kind === null
      ? base
      : { ...base, kind, ...(playerId === null ? {} : { playerId }), ...keepType };
  if (!isValidPointTag(next)) return set;
  return replaceLast(set, next);
}

/**
 * v7: a new set where the last rally's "our error" tag carries `errorType` (`null` clears it).
 * When the last rally was lost and is untagged, it becomes "our error" with that type. Any
 * other last event (a sub, a rally we won, another kind) returns the set unchanged.
 */
export function setLastErrorType(set: SetLineup, errorType: ErrorType | null): SetLineup {
  const last = set.events[set.events.length - 1];
  if (last === undefined || last.type !== 'point' || last.winner !== 'them') return set;
  if (last.kind !== undefined && last.kind !== 'ourError') return set;
  const { errorType: _old, ...rest } = last;
  const next: PointEvent = errorType === null ? rest : { ...rest, kind: 'ourError', errorType };
  if (!isValidPointTag(next)) return set;
  return replaceLast(set, next);
}
