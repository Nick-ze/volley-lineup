/**
 * v8 motion rules for tabs (PLAN §31.2): which side new tab content slides in from, and which
 * tab a horizontal swipe goes to. Pure functions, no React.
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
/** A swipe this long (px) changes the tab… */
export const TAB_SWIPE_DISTANCE = 64;
/** …or a shorter one this fast (px/s) in the same direction (a flick). */
export const TAB_SWIPE_VELOCITY = 600;

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
 * A finished horizontal swipe as a tab step: swiping left (negative x) goes to the next tab,
 * right to the previous one; too short and too slow is nothing.
 */
export function swipeTabStep(translationX: number, velocityX: number): SlideDirection {
  const direction = translationX < 0 ? 1 : translationX > 0 ? -1 : 0;
  if (Math.abs(translationX) >= TAB_SWIPE_DISTANCE) return direction;
  const flick =
    Math.abs(velocityX) >= TAB_SWIPE_VELOCITY && Math.sign(velocityX) === Math.sign(translationX);
  return flick ? direction : 0;
}

/** The index `step` tabs away from `index`, or null past the first / last tab (no wrap-around). */
export function stepTab(index: number, step: number, count: number): number | null {
  const next = index + step;
  if (step === 0 || index < 0 || next < 0 || next >= count) return null;
  return next;
}

/**
 * The index of the tab a swipe on `current` leads to, or null (too short, or already at the
 * end). An index, not the tab itself, because a tab may be null ("All sets").
 */
export function swipeTarget<T>(
  tabs: readonly T[],
  current: T,
  translationX: number,
  velocityX: number,
): number | null {
  return stepTab(tabs.indexOf(current), swipeTabStep(translationX, velocityX), tabs.length);
}
