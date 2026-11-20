/** Layout constants for the rotation viewer and starters overview (sizes in px). */
import { touchTarget } from '@/theme';

/** Player chip diameter on the full-size rotation court (and the libero beside it). */
export const CHIP_SIZE = 56;
/** Player chip diameter on compact courts (starters cards); never below the touch target. */
export const COMPACT_CHIP_SIZE = touchTarget;

/** Max width of the full-size court column and the stepper above it. */
export const COURT_MAX_WIDTH = 520;
/** Max width of a compact court. */
export const COMPACT_COURT_MAX_WIDTH = 340;
/** Min height of one slot on a compact court. */
export const COMPACT_SLOT_MIN_HEIGHT = 84;

/** Width of the libero / serve-info column beside the court on wide screens. */
export const SIDE_PANEL_WIDTH = 200;
/** Width of one set card in the starters overview. */
export const STARTERS_CARD_WIDTH = 300;

/** Horizontal movement (px) before the swipe gesture activates; vertical movement beyond it cancels. */
export const SWIPE_ACTIVATION_OFFSET = 20;
/** Horizontal distance (px) a swipe must travel to change rotation. */
export const SWIPE_THRESHOLD = 50;
