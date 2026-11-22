/**
 * v8: the roster's player cards (docs/PLAN.md §31.4). How many cards fit side by side in the
 * available width: 2 on a 375 px phone, more on wide screens, never more than 5. Pure functions.
 */

/** A card is at least this wide, unless only the minimum number of columns fits. */
export const MIN_CARD_WIDTH = 180;
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 5;

/** Number of card columns for `width` px of room with `gap` px between cards. */
export function rosterColumns(width: number, gap: number): number {
  if (!Number.isFinite(width) || width <= 0) return MIN_COLUMNS;
  const fit = Math.floor((width + gap) / (MIN_CARD_WIDTH + gap));
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, fit));
}

/** Width of one card when `columns` cards and their gaps fill `width` (rounded down). */
export function rosterCardWidth(width: number, columns: number, gap: number): number {
  const free = width - gap * (columns - 1);
  return Math.max(0, Math.floor(free / columns));
}
