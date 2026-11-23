/**
 * v8 tab slide (PLAN §31.2): which side new tab content slides in from, and how far.
 * Used by `SlideTransition` and the tab steps of the pager. Pure functions, no React.
 *
 * Part of the `tabMotion.ts` barrel (v8.3 split): import sibling modules directly, never the
 * barrel. Functions that run on the UI thread keep their 'worklet' directive.
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
