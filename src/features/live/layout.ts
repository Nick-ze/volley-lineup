/** Layout constants for live match mode (sizes in px). */
import { touchTarget } from '@/theme';

/** Font size of the big score digits. */
export const SCORE_FONT_SIZE = 64;
/** Min height of the two big "Point us" / "Point them" buttons (well above the 44 px target). */
export const POINT_BUTTON_MIN_HEIGHT = 88;
/**
 * v8 QA: their min height while "Who serves first" is shown above them (before a set's first
 * rally), so the court and Substitution still fit at 390×844 (DECISIONS #126).
 */
export const POINT_BUTTON_COMPACT_MIN_HEIGHT = 64;
/** Font size of the point button labels. */
export const POINT_BUTTON_FONT_SIZE = 22;
/** Player chip diameter on the live court. */
export const LIVE_CHIP_SIZE = 56;
/** Player chip diameter on the substitution bench. */
export const BENCH_CHIP_SIZE = touchTarget + 8;
/** Width of the court column on wide screens. */
export const COURT_COLUMN_MAX_WIDTH = 520;
/** Width of the score/controls column on wide screens. */
export const CONTROLS_COLUMN_WIDTH = 420;
/** Size of the "serving" dot next to a team name. */
export const SERVE_DOT_SIZE = 14;
/** Max width of a bench chip + its warning caption. */
export const BENCH_ITEM_MAX_WIDTH = 96;
