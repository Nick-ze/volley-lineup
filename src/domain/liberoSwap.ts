/**
 * Libero swaps (docs/PLAN.md §11.1). Pure functions, no React, no storage.
 *
 * The libero replaces one of the chosen starters (`SetLineup.liberoReplaces`, usually the
 * middles) whenever that starter is in the back row (positions 1, 5, 6) — except at position 1
 * when that player is about to serve, because the libero may not serve. The rotation viewer
 * always treats position 1 as the server.
 *
 * There is only one libero: if two chosen starters are in the back row at the same time, the
 * one listed first in `liberoReplaces` is replaced.
 */
import { BACK_ROW_POSITIONS, serverPosition, type Slots } from './rotation';
import { COURT_POSITIONS, type CourtPosition, type Player, type SetLineup } from './types';

/** Where the libero stands in for a starter: the court position and whom they replace. */
export interface LiberoSwap {
  position: CourtPosition;
  replacedId: string;
}

export interface LiberoSwapOptions {
  /** True when the player at position 1 is serving (default: always, as in the rotation viewer). */
  serving?: boolean;
}

/** Back-row positions the libero may take, given whether position 1 is serving. */
function eligiblePositions(serving: boolean): readonly CourtPosition[] {
  return serving ? BACK_ROW_POSITIONS.filter((p) => p !== serverPosition) : BACK_ROW_POSITIONS;
}

/**
 * The swap the libero makes in these slots, or null when there is none (no libero, nothing
 * chosen, no chosen starter in an eligible back-row spot, or the libero is already on court).
 */
export function findLiberoSwap(
  slots: Slots,
  liberoId: string | null,
  liberoReplaces: readonly string[],
  { serving = true }: LiberoSwapOptions = {},
): LiberoSwap | null {
  if (liberoId === null || COURT_POSITIONS.some((p) => slots[p] === liberoId)) return null;
  const eligible = eligiblePositions(serving);
  for (const replacedId of liberoReplaces) {
    const position = eligible.find((p) => slots[p] === replacedId);
    if (position !== undefined) return { position, replacedId };
  }
  return null;
}

/** The slots with the libero in place of the replaced back-row starter (unchanged if none). */
export function applyLiberoSwaps(
  slots: Slots,
  liberoId: string | null,
  liberoReplaces: readonly string[],
  options: LiberoSwapOptions = {},
): Slots {
  if (liberoId === null) return slots;
  const swap = findLiberoSwap(slots, liberoId, liberoReplaces, options);
  if (swap === null) return slots;
  return { ...slots, [swap.position]: liberoId };
}

/** Default choice of whom the libero replaces: the starters whose primary position is MB. */
export function suggestLiberoReplaces(set: SetLineup, players: readonly Player[]): string[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return COURT_POSITIONS.map((p) => set.slots[p]).filter(
    (id): id is string => id !== null && byId.get(id)?.positions[0] === 'MB',
  );
}

/**
 * Applies the default suggestion when a libero is assigned to a set that had none and nobody is
 * chosen yet. Any later choice (including "nobody") is left alone.
 */
export function withSuggestedLiberoReplaces(
  previous: SetLineup,
  next: SetLineup,
  players: readonly Player[],
): SetLineup {
  if (previous.liberoId !== null || next.liberoId === null || next.liberoReplaces.length > 0) {
    return next;
  }
  const suggested = suggestLiberoReplaces(next, players);
  return suggested.length === 0 ? next : { ...next, liberoReplaces: suggested };
}
