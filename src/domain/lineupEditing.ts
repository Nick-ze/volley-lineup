/**
 * Pure lineup editing operations used by the lineup builder (drag & drop and tap-to-select).
 * Every function returns a new `SetLineup` and never mutates its input.
 *
 * Invariant kept by every operation: a player id appears at most once in a set
 * (in one of the six slots OR as the libero, never both, never twice).
 */
import { emptySetLineup } from './lineup';
import {
  COURT_POSITIONS,
  type CourtPosition,
  type Player,
  type SetLineup,
  type SetNumber,
} from './types';

/** Where a player currently is within a set. */
export type PlayerLocation =
  { kind: 'slot'; position: CourtPosition } | { kind: 'libero' } | { kind: 'bench' };

/** A place a player can be dropped onto (drag & drop and tap-to-select share this). */
export type DropTarget =
  { kind: 'slot'; position: CourtPosition } | { kind: 'libero' } | { kind: 'bench' };

/** Court position of a player in this set, or null if not on court. */
export function findSlot(set: SetLineup, playerId: string): CourtPosition | null {
  return COURT_POSITIONS.find((p) => set.slots[p] === playerId) ?? null;
}

export function locatePlayer(set: SetLineup, playerId: string): PlayerLocation {
  const position = findSlot(set, playerId);
  if (position !== null) return { kind: 'slot', position };
  if (set.liberoId === playerId) return { kind: 'libero' };
  return { kind: 'bench' };
}

/** Removes a player from every slot and the libero spot. */
export function removePlayer(set: SetLineup, playerId: string): SetLineup {
  const slots = { ...set.slots };
  COURT_POSITIONS.forEach((p) => {
    if (slots[p] === playerId) slots[p] = null;
  });
  return { ...set, slots, liberoId: set.liberoId === playerId ? null : set.liberoId };
}

/** Swaps the contents of two court positions (either may be empty). */
export function swapSlots(set: SetLineup, a: CourtPosition, b: CourtPosition): SetLineup {
  const slots = { ...set.slots, [a]: set.slots[b], [b]: set.slots[a] };
  return { ...set, slots };
}

/**
 * Puts a player on a court position.
 * - Already in another slot → the two slots are swapped (the occupant moves to the old slot).
 * - Currently the libero → the libero spot is cleared.
 * - The previous occupant of `position` (if any, and not swapped) goes to the bench.
 */
export function placePlayer(set: SetLineup, playerId: string, position: CourtPosition): SetLineup {
  const from = findSlot(set, playerId);
  if (from !== null) return swapSlots(set, from, position);
  const cleared = removePlayer(set, playerId);
  return { ...cleared, slots: { ...cleared.slots, [position]: playerId } };
}

/** Empties one court position (the player goes back to the bench). */
export function removeFromCourt(set: SetLineup, position: CourtPosition): SetLineup {
  return { ...set, slots: { ...set.slots, [position]: null } };
}

/** Sets (or clears with `null`) the libero. A player taken as libero leaves the court. */
export function setLibero(set: SetLineup, playerId: string | null): SetLineup {
  const base = playerId === null ? set : removePlayer(set, playerId);
  return { ...base, liberoId: playerId };
}

export function setServeFirst(set: SetLineup, weServeFirst: boolean): SetLineup {
  return { ...set, weServeFirst };
}

/** Empties the court and libero, keeping set number and serve choice. */
export function clearLineup(set: SetLineup): SetLineup {
  return { ...emptySetLineup(set.setNumber), weServeFirst: set.weServeFirst };
}

/**
 * Copies the six starters and the libero of `from` into a lineup for `toSetNumber`.
 * The serve choice is not part of the lineup: pass the target set's current value to keep it
 * (defaults to the source's value).
 */
export function copyLineup(
  from: SetLineup,
  toSetNumber: SetNumber,
  weServeFirst: boolean = from.weServeFirst,
): SetLineup {
  return {
    setNumber: toSetNumber,
    slots: { ...from.slots },
    liberoId: from.liberoId,
    weServeFirst,
  };
}

/** Active players that are neither on court nor the libero, sorted by jersey number. */
export function benchPlayers(set: SetLineup, players: Player[]): Player[] {
  const used = new Set<string>(
    COURT_POSITIONS.map((p) => set.slots[p]).filter((id): id is string => id !== null),
  );
  if (set.liberoId) used.add(set.liberoId);
  return players.filter((p) => p.active && !used.has(p.id)).sort((a, b) => a.number - b.number);
}

/** Moves a player onto a drop target. Same logic for drag & drop and tap-to-select. */
export function movePlayer(set: SetLineup, playerId: string, target: DropTarget): SetLineup {
  switch (target.kind) {
    case 'slot':
      return placePlayer(set, playerId, target.position);
    case 'libero':
      return set.liberoId === playerId ? set : setLibero(set, playerId);
    case 'bench':
      return removePlayer(set, playerId);
  }
}

/** The lineup for `setNumber` from a match's sets, or a fresh empty one if it doesn't exist yet. */
export function lineupForSet(sets: SetLineup[], setNumber: SetNumber): SetLineup {
  return sets.find((s) => s.setNumber === setNumber) ?? emptySetLineup(setNumber);
}

/** The previous set's lineup if it exists (never for set 1). */
export function previousSet(sets: SetLineup[], setNumber: SetNumber): SetLineup | null {
  return sets.find((s) => s.setNumber === setNumber - 1) ?? null;
}
