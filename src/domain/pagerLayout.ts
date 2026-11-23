/**
 * v8.1.1 pager layout: which pages are mounted and where each one sits for the shared position
 * (`TabPager`, `useTabPager`, `SwipeTabs`). Pure functions, no React.
 *
 * Part of the `tabMotion.ts` barrel (v8.3 split): import sibling modules directly, never the
 * barrel. Functions that run on the UI thread keep their 'worklet' directive.
 */
import { dragPosition } from './tabDrag';

/** v8.1.1: a page that is not aliased (see `pageSlot`). */
export const NO_PAGE = -1;

/*
 * v8.1.1 pager without hand-over: every page near the shown tab stays mounted, keyed by its tab,
 * at its own slot in a row; one shared position (in pages, fractional while moving) places them
 * all. A drag and a tap only move that position, so a tab change never remounts or swaps a page.
 */

/**
 * The tab indices whose pages are mounted, in order: the shown tab (`index`) and the page at rest
 * (`rest`, the one a slide is leaving), each with its neighbours once `neighbours` is on (a frame
 * after the first render, so the shown page draws first). Indices outside the tabs are left out.
 */
export function pagerWindow(
  index: number,
  rest: number,
  count: number,
  neighbours: boolean,
): number[] {
  const spread = neighbours ? 1 : 0;
  const shown = new Set<number>();
  for (const centre of [index, rest]) {
    if (centre < 0 || centre >= count) continue;
    for (let i = Math.max(0, centre - spread); i <= Math.min(count - 1, centre + spread); i++) {
      shown.add(i);
    }
  }
  return [...shown].sort((a, b) => a - b);
}

/**
 * The slot a page sits at in the row: its tab index, except the aliased page (a tap jumping over
 * tabs), which stands in at `aliasSlot` right beside the target, so a jump slides one page wide.
 */
export function pageSlot(index: number, aliasPage: number, aliasSlot: number): number {
  'worklet';
  return index === aliasPage ? aliasSlot : index;
}

/**
 * A page's opacity: hidden while an aliased page stands in at its slot; before the pager is
 * measured (all pages at 0) only the page at the position shows.
 */
export function pageOpacity(
  index: number,
  position: number,
  width: number,
  aliasPage: number,
  aliasSlot: number,
): number {
  'worklet';
  if (aliasPage !== NO_PAGE && index !== aliasPage && index === aliasSlot) return 0;
  if (width > 0) return 1;
  return pageSlot(index, aliasPage, aliasSlot) === Math.round(position) ? 1 : 0;
}

/** A page's translateX (px): its slot's distance from the position, in page widths. */
export function pageTranslate(
  index: number,
  position: number,
  width: number,
  aliasPage: number,
  aliasSlot: number,
): number {
  'worklet';
  return (pageSlot(index, aliasPage, aliasSlot) - position) * width;
}

/**
 * How far (px) a drag has moved the row from the shown tab `current`: the gesture's movement
 * since it took over (`moved`) plus where the row was then (`startPosition`: a drag can catch it
 * still moving).
 */
export function dragFromTab(
  current: number,
  startPosition: number,
  width: number,
  moved: number,
): number {
  'worklet';
  return (current - startPosition) * width + moved;
}

/** The row's position (pages) for a drag `offset` px from `current` (see `dragPosition`). */
export function dragToPosition(
  current: number,
  offset: number,
  hasNeighbour: boolean,
  width: number,
): number {
  'worklet';
  if (width <= 0) return current;
  return current - dragPosition(offset, hasNeighbour, width) / width;
}

/** Where a slide to a tab starts, and which page (if any) stands in beside the target. */
export interface SlideStart {
  start: number;
  aliasPage: number;
  aliasSlot: number;
}

/**
 * A slide from `position` to the tab `target` (a tap): straight there when it is at most one page
 * away; a jump over tabs moves the page now shown (the nearest) right beside the target and slides
 * one page, so the tabs in between never pass by.
 */
export function slideStart(position: number, target: number): SlideStart {
  'worklet';
  if (Math.abs(target - position) <= 1) {
    return { start: position, aliasPage: NO_PAGE, aliasSlot: 0 };
  }
  const near = Math.round(position);
  const slot = target - Math.sign(target - near);
  return { start: slot, aliasPage: near, aliasSlot: slot };
}
