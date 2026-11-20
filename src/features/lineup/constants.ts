/** Layout constants of the lineup builder (sizes in px). */
import { touchTarget } from '@/theme';

/** Diameter of a player chip on court, libero slot and bench. */
export const CHIP_SIZE = 56;
/** Diameter of the chip that follows the pointer while dragging (before the 1.15 lift scale). */
export const DRAG_CHIP_SIZE = 64;
/** Empty court / libero slot target: same footprint as a chip, never below the touch target. */
export const EMPTY_SLOT_SIZE = Math.max(CHIP_SIZE, touchTarget);
/** The libero box is at least as wide as one court slot's chip plus its name. */
export const LIBERO_BOX_MIN_WIDTH = 104;
/** Bench column minimum height in the wide layout, where it scrolls on its own. */
export const BENCH_MIN_HEIGHT = 240;
/** Opacity of the original chip while its lifted copy is being dragged. */
export const DRAG_GHOST_OPACITY = 0.35;
