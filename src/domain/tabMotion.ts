/**
 * v8 motion rules for tabs (PLAN §31.2): which side new tab content slides in from, and which
 * tab a horizontal drag goes to (v8.1: an interactive pager). Pure functions, no React.
 */

/** How long a tab's content takes to slide in (ms). */
export const SLIDE_DURATION_MS = 220;
/** How far new content starts beside its place, as a share of the content's width… */
export const SLIDE_DISTANCE_RATIO = 0.25;
/** …but never more than this (px), so wide screens don't fly in from far away. */
export const SLIDE_MAX_DISTANCE = 96;
/** Used until the content has been measured (px). */
export const SLIDE_FALLBACK_DISTANCE = 64;
/** Opacity new content starts at (it fades in while it slides). */
export const SLIDE_START_OPACITY = 0.3;

/** Horizontal movement (px) before the tab swipe takes over; vertical movement beyond fails it. */
export const TAB_SWIPE_ACTIVATION = 24;
/** v8.1: a drag past this share of the width goes on to the neighbouring tab when released… */
export const TAB_DRAG_COMMIT_RATIO = 0.35;
/** …as does a shorter one released this fast (px/s) in the drag direction (a flick). */
export const TAB_DRAG_FLICK_VELOCITY = 500;
/** …or this far (px) while the width is not measured yet. */
export const TAB_DRAG_FALLBACK_DISTANCE = 64;
/** A finger still for longer than this (ms) before letting go released the drag without speed. */
export const TAB_DRAG_STILL_MS = 80;
/** Past the first / last tab the content follows the finger this much (rubber band). */
export const TAB_DRAG_EDGE_RESISTANCE = 0.3;
/** The rest of a drag (to the neighbour or back) takes at most this long (ms)… */
export const TAB_SETTLE_MAX_MS = 260;
/** …and at least this long, however fast the flick. */
export const TAB_SETTLE_MIN_MS = 120;
/**
 * After a drag went on to the neighbour, the pager waits this long (ms) for the screen to show
 * that tab; if it never does, the pager goes back to the shown tab. v8.1.1: long enough for a
 * slow phone to render the new tab (the page is already in place, so waiting shows nothing wrong).
 */
export const TAB_COMMIT_FALLBACK_MS = 1000;
/** v8.1.1: a page that is not aliased (see `pageSlot`). */
export const NO_PAGE = -1;

/** -1: new content comes from the left, 1: from the right, 0: no slide. */
export type SlideDirection = -1 | 0 | 1;

/** The chosen tab lies to the right of the old one → its content comes from the right. */
export function slideDirection(previous: number, next: number): SlideDirection {
  if (next > previous) return 1;
  if (next < previous) return -1;
  return 0;
}

/** Where new content starts (px, translateX) for a slide in `direction` over content `width` wide. */
export function slideOffset(direction: SlideDirection, width: number): number {
  const distance =
    width > 0
      ? Math.min(width * SLIDE_DISTANCE_RATIO, SLIDE_MAX_DISTANCE)
      : SLIDE_FALLBACK_DISTANCE;
  return direction * distance;
}

/**
 * The index `step` tabs away from `index`, or null past the first / last tab (no wrap-around).
 * An index, not the tab itself, because a tab may be null ("All sets").
 */
export function stepTab(index: number, step: number, count: number): number | null {
  'worklet';
  const next = index + step;
  if (step === 0 || index < 0 || next < 0 || next >= count) return null;
  return next;
}

/*
 * v8.1 interactive pager (the drag runs on the UI thread, hence the 'worklet' directives): the
 * current tab follows the finger with its neighbour beside it, and the release decides.
 */

/**
 * How far the content has been dragged (px): the gesture's translation since the drag took over
 * (`activationX`, its translation then), so the content doesn't jump when it starts to move.
 */
export function dragOffset(translationX: number, activationX: number): number {
  'worklet';
  return translationX - activationX;
}

/** The tab a drag shows beside the current one: dragging left (negative) → the next tab (1). */
export function dragSide(offset: number): SlideDirection {
  'worklet';
  if (offset < 0) return 1;
  if (offset > 0) return -1;
  return 0;
}

/**
 * Where the current tab's content sits during a drag (translateX): with the finger while there is
 * a neighbour on that side (never further than one page), at `TAB_DRAG_EDGE_RESISTANCE` past the
 * first / last tab (rubber band).
 */
export function dragPosition(offset: number, hasNeighbour: boolean, width: number): number {
  'worklet';
  if (!hasNeighbour) return offset * TAB_DRAG_EDGE_RESISTANCE;
  return width > 0 ? Math.max(-width, Math.min(width, offset)) : offset;
}

/**
 * The velocity a drag was released with: none when the finger had stopped for longer than
 * `TAB_DRAG_STILL_MS` before letting go (on web the reported velocity is the last movement's,
 * however long ago), so a pause before the release is never a flick.
 */
export function releaseVelocity(velocityX: number, msSinceLastMove: number): number {
  'worklet';
  return msSinceLastMove > TAB_DRAG_STILL_MS ? 0 : velocityX;
}

/**
 * A released drag as a tab step (1 next, -1 previous, 0 back): a flick goes the way it was
 * flicked (in the drag direction → on, against it → back); otherwise on when past
 * `TAB_DRAG_COMMIT_RATIO` of the width (`TAB_DRAG_FALLBACK_DISTANCE` before it is measured).
 * Never a step without a neighbour.
 */
export function dragCommit(
  offset: number,
  velocityX: number,
  width: number,
  hasNeighbour: boolean,
): SlideDirection {
  'worklet';
  const side = dragSide(offset);
  if (!hasNeighbour || side === 0) return 0;
  if (Math.abs(velocityX) >= TAB_DRAG_FLICK_VELOCITY) {
    return Math.sign(velocityX) === Math.sign(offset) ? side : 0;
  }
  const needed = width > 0 ? width * TAB_DRAG_COMMIT_RATIO : TAB_DRAG_FALLBACK_DISTANCE;
  return Math.abs(offset) >= needed ? side : 0;
}

/**
 * How long the rest of a drag takes (ms) for `distance` px left, released at `velocityX`: an
 * ease-out cubic starts at 3 × distance / duration, so this keeps the finger's speed, within
 * `TAB_SETTLE_MIN_MS`…`TAB_SETTLE_MAX_MS`.
 */
export function settleDuration(distance: number, velocityX: number): number {
  'worklet';
  const speed = Math.abs(velocityX);
  if (speed === 0) return TAB_SETTLE_MAX_MS;
  const keepSpeed = ((3 * Math.abs(distance)) / speed) * 1000;
  return Math.max(TAB_SETTLE_MIN_MS, Math.min(TAB_SETTLE_MAX_MS, keepSpeed));
}

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
