/**
 * v11: the app's small motions (PLAN §46, DECISIONS: motion). All of them are short and none
 * delays a tap; with the OS "reduce motion" setting the animated ones don't run.
 */

/** A pressed button, row, card or tile shrinks a little (with its lower opacity). */
export const PRESS_SCALE = 0.97;

/**
 * The spring for things that move or change size (the tab bar's marker, the score's tick): quick,
 * with a slight overshoot. Stiffness 380 and a damping ratio of 0.8 (2 × 0.8 × √380 ≈ 31).
 */
export const SPRING = { stiffness: 380, damping: 31, mass: 1 } as const;

/** The score that changed grows to this … */
export const TICK_SCALE = 1.12;
/** … in this many ms, then springs back. */
export const TICK_UP_MS = 90;
