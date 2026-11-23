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
/** App tab bar: progress (|p| < 1) past which a scene counts as moving rather than resting. */
const SCENE_MOVING_EDGE = 0.99;
/**
 * v8 QA: opacity of an app tab scene by its progress (-1 left of the focused tab, 0 focused,
 * 1 right). Scenes resting at ±1 are hidden, so a tab skipped by a jump (Settings → Teams) never
 * shows through the two moving scenes, which fade between `SLIDE_START_OPACITY` and 1 as before.
 */
export const TAB_SCENE_OPACITY = {
  inputRange: [-1, -SCENE_MOVING_EDGE, 0, SCENE_MOVING_EDGE, 1],
  outputRange: [0, SLIDE_START_OPACITY, 1, SLIDE_START_OPACITY, 0],
};

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
 * that tab; if it doesn't (the app tab bar: another screen shows it), the pager resets.
 */
export const TAB_COMMIT_FALLBACK_MS = 250;

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
