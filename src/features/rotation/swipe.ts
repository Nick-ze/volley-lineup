/** Horizontal distance (px) a swipe must travel to change rotation. */
export const SWIPE_THRESHOLD = 50;

/**
 * Maps a finished horizontal swipe to a rotation step: swiping left (negative x) shows the
 * next rotation, swiping right the previous one, anything shorter than the threshold nothing.
 */
export function swipeStep(translationX: number, threshold = SWIPE_THRESHOLD): -1 | 0 | 1 {
  if (translationX <= -threshold) return 1;
  if (translationX >= threshold) return -1;
  return 0;
}
