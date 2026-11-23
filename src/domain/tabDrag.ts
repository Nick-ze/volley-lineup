/**
 * v8.1 tab drag: which tab a horizontal drag goes to, and how the release settles
 * (`usePagerGesture`). Pure functions, no React.
 *
 * Part of the `tabMotion.ts` barrel (v8.3 split): import sibling modules directly, never the
 * barrel. Functions that run on the UI thread keep their 'worklet' directive.
 */
import type { SlideDirection } from './slideMotion';

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
