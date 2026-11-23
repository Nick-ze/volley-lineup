import {
  NO_PAGE,
  SLIDE_FALLBACK_DISTANCE,
  SLIDE_MAX_DISTANCE,
  TAB_DRAG_COMMIT_RATIO,
  TAB_DRAG_EDGE_RESISTANCE,
  TAB_DRAG_FALLBACK_DISTANCE,
  TAB_DRAG_FLICK_VELOCITY,
  TAB_DRAG_STILL_MS,
  TAB_SETTLE_MAX_MS,
  TAB_SETTLE_MIN_MS,
  TAB_SWIPE_ACTIVATION,
  dragCommit,
  dragFromTab,
  dragOffset,
  dragPosition,
  dragSide,
  dragToPosition,
  pageOpacity,
  pageSlot,
  pageTranslate,
  pagerWindow,
  releaseVelocity,
  settleDuration,
  slideDirection,
  slideOffset,
  slideStart,
  stepTab,
} from './tabMotion';

describe('slideDirection', () => {
  it('slides from the side of the chosen tab', () => {
    expect(slideDirection(0, 2)).toBe(1);
    expect(slideDirection(3, 1)).toBe(-1);
    expect(slideDirection(2, 2)).toBe(0);
  });
});

describe('slideOffset', () => {
  it('is a quarter of the width, capped, with the sign of the direction', () => {
    expect(slideOffset(1, 200)).toBe(50);
    expect(slideOffset(-1, 200)).toBe(-50);
    expect(slideOffset(1, 2000)).toBe(SLIDE_MAX_DISTANCE);
    expect(slideOffset(0, 200)).toBe(0);
  });

  it('uses a fallback before the content is measured', () => {
    expect(slideOffset(-1, 0)).toBe(-SLIDE_FALLBACK_DISTANCE);
  });
});

describe('dragOffset', () => {
  it('counts from where the drag took over, without a jump', () => {
    expect(dragOffset(-TAB_SWIPE_ACTIVATION, -TAB_SWIPE_ACTIVATION)).toBe(0);
    expect(dragOffset(TAB_SWIPE_ACTIVATION + 10, TAB_SWIPE_ACTIVATION)).toBe(10);
    expect(dragOffset(-TAB_SWIPE_ACTIVATION - 100, -TAB_SWIPE_ACTIVATION)).toBe(-100);
    // Back past the start point: the other way.
    expect(dragOffset(0, -TAB_SWIPE_ACTIVATION)).toBe(TAB_SWIPE_ACTIVATION);
  });
});

describe('dragSide', () => {
  it('shows the next tab when dragging left, the previous when dragging right', () => {
    expect(dragSide(-5)).toBe(1);
    expect(dragSide(5)).toBe(-1);
    expect(dragSide(0)).toBe(0);
  });
});

describe('dragPosition', () => {
  it('follows the finger 1:1 towards a neighbour, at most one page', () => {
    expect(dragPosition(-150, true, 400)).toBe(-150);
    expect(dragPosition(150, true, 400)).toBe(150);
    expect(dragPosition(-500, true, 400)).toBe(-400);
    expect(dragPosition(500, true, 400)).toBe(400);
    // Not measured yet: no limit.
    expect(dragPosition(-500, true, 0)).toBe(-500);
  });

  it('resists past the first / last tab (rubber band)', () => {
    expect(dragPosition(-100, false, 400)).toBeCloseTo(-100 * TAB_DRAG_EDGE_RESISTANCE);
    expect(dragPosition(100, false, 400)).toBeCloseTo(100 * TAB_DRAG_EDGE_RESISTANCE);
  });
});

describe('dragCommit', () => {
  const width = 400;
  const past = width * TAB_DRAG_COMMIT_RATIO;

  it('goes on past the commit share of the width, else back', () => {
    expect(dragCommit(-past, 0, width, true)).toBe(1);
    expect(dragCommit(past + 1, 0, width, true)).toBe(-1);
    expect(dragCommit(-(past - 1), 0, width, true)).toBe(0);
    expect(dragCommit(width * 0.2, 0, width, true)).toBe(0);
    expect(dragCommit(-width / 2, -100, width, true)).toBe(1);
  });

  it('goes on after a flick in the drag direction, back after a flick against it', () => {
    expect(dragCommit(-30, -TAB_DRAG_FLICK_VELOCITY, width, true)).toBe(1);
    expect(dragCommit(30, TAB_DRAG_FLICK_VELOCITY + 1, width, true)).toBe(-1);
    expect(dragCommit(-width * 0.8, TAB_DRAG_FLICK_VELOCITY, width, true)).toBe(0);
  });

  it('needs a fixed distance before the width is measured', () => {
    expect(dragCommit(-TAB_DRAG_FALLBACK_DISTANCE, 0, 0, true)).toBe(1);
    expect(dragCommit(-(TAB_DRAG_FALLBACK_DISTANCE - 1), 0, 0, true)).toBe(0);
  });

  it('never steps without a neighbour or without a drag', () => {
    expect(dragCommit(-width, -2000, width, false)).toBe(0);
    expect(dragCommit(0, -2000, width, true)).toBe(0);
  });
});

describe('releaseVelocity', () => {
  it('keeps the speed of a release while moving, none after a pause', () => {
    expect(releaseVelocity(-900, 10)).toBe(-900);
    expect(releaseVelocity(-900, TAB_DRAG_STILL_MS)).toBe(-900);
    expect(releaseVelocity(-900, TAB_DRAG_STILL_MS + 1)).toBe(0);
  });
});

describe('settleDuration', () => {
  it('keeps the release speed, within the limits', () => {
    // 3 × 100 px / 2000 px/s = 150 ms.
    expect(settleDuration(100, -2000)).toBe(150);
    expect(settleDuration(-100, 2000)).toBe(150);
    expect(settleDuration(10, 5000)).toBe(TAB_SETTLE_MIN_MS);
    expect(settleDuration(300, 100)).toBe(TAB_SETTLE_MAX_MS);
    expect(settleDuration(300, 0)).toBe(TAB_SETTLE_MAX_MS);
  });
});

describe('stepTab', () => {
  it('moves within bounds and stops at the ends', () => {
    expect(stepTab(1, 1, 3)).toBe(2);
    expect(stepTab(1, -1, 3)).toBe(0);
    expect(stepTab(2, 1, 3)).toBeNull();
    expect(stepTab(0, -1, 3)).toBeNull();
    expect(stepTab(1, 0, 3)).toBeNull();
    expect(stepTab(-1, 1, 3)).toBeNull();
  });
});

describe('pagerWindow (v8.1.1)', () => {
  it('mounts the shown tab and its neighbours, within the tabs', () => {
    expect(pagerWindow(2, 2, 5, true)).toEqual([1, 2, 3]);
    expect(pagerWindow(0, 0, 5, true)).toEqual([0, 1]);
    expect(pagerWindow(4, 4, 5, true)).toEqual([3, 4]);
    expect(pagerWindow(0, 0, 1, true)).toEqual([0]);
  });

  it('keeps the page a slide leaves (and its neighbours) until it is at rest', () => {
    expect(pagerWindow(4, 0, 5, true)).toEqual([0, 1, 3, 4]);
    expect(pagerWindow(1, 0, 5, true)).toEqual([0, 1, 2]);
  });

  it('mounts only the shown page before the first frame, nothing for an unknown tab', () => {
    expect(pagerWindow(2, 2, 5, false)).toEqual([2]);
    expect(pagerWindow(-1, -1, 5, true)).toEqual([]);
    expect(pagerWindow(7, 2, 5, false)).toEqual([2]);
  });
});

describe('page placement (v8.1.1)', () => {
  it('places each page at its slot relative to the position', () => {
    expect(pageTranslate(2, 2, 400, NO_PAGE, 0)).toBe(0);
    expect(pageTranslate(3, 2, 400, NO_PAGE, 0)).toBe(400);
    expect(pageTranslate(1, 2.5, 400, NO_PAGE, 0)).toBe(-600);
    expect(pageSlot(1, NO_PAGE, 0)).toBe(1);
  });

  it('moves an aliased page to its stand-in slot and hides the page there', () => {
    expect(pageSlot(0, 0, 3)).toBe(3);
    expect(pageTranslate(0, 3, 400, 0, 3)).toBe(0);
    expect(pageOpacity(3, 3, 400, 0, 3)).toBe(0);
    expect(pageOpacity(0, 3, 400, 0, 3)).toBe(1);
    expect(pageOpacity(4, 3, 400, 0, 3)).toBe(1);
  });

  it('shows only the page at the position before the pager is measured', () => {
    expect(pageOpacity(2, 2, 0, NO_PAGE, 0)).toBe(1);
    expect(pageOpacity(3, 2, 0, NO_PAGE, 0)).toBe(0);
    expect(pageOpacity(0, 3, 0, 0, 3)).toBe(1);
  });
});

describe('drag position (v8.1.1)', () => {
  it('counts the drag from the shown tab, including where the row was caught', () => {
    expect(dragFromTab(2, 2, 400, -50)).toBe(-50);
    expect(dragFromTab(2, 2.25, 400, 0)).toBe(-100);
  });

  it('turns a drag into the row position, rubber-banding at the ends', () => {
    expect(dragToPosition(2, -200, true, 400)).toBe(2.5);
    expect(dragToPosition(2, 200, true, 400)).toBe(1.5);
    expect(dragToPosition(0, 100, false, 400)).toBeCloseTo((-100 * TAB_DRAG_EDGE_RESISTANCE) / 400);
    expect(dragToPosition(2, -200, true, 0)).toBe(2);
  });
});

describe('slideStart (v8.1.1)', () => {
  it('slides straight to a tab one page away (also from a moving position)', () => {
    expect(slideStart(2, 3)).toEqual({ start: 2, aliasPage: NO_PAGE, aliasSlot: 0 });
    expect(slideStart(2.4, 2)).toEqual({ start: 2.4, aliasPage: NO_PAGE, aliasSlot: 0 });
  });

  it('jumps over tabs with the shown page beside the target', () => {
    expect(slideStart(0, 4)).toEqual({ start: 3, aliasPage: 0, aliasSlot: 3 });
    expect(slideStart(4, 1)).toEqual({ start: 2, aliasPage: 4, aliasSlot: 2 });
    expect(slideStart(0.6, 3)).toEqual({ start: 2, aliasPage: 1, aliasSlot: 2 });
  });
});
