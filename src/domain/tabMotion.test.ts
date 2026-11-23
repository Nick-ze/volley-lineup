import {
  SLIDE_FALLBACK_DISTANCE,
  SLIDE_START_OPACITY,
  TAB_SCENE_OPACITY,
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
  dragOffset,
  dragPosition,
  dragSide,
  releaseVelocity,
  settleDuration,
  slideDirection,
  slideOffset,
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

describe('TAB_SCENE_OPACITY', () => {
  it('hides resting scenes and fades moving ones from the start opacity', () => {
    const { inputRange, outputRange } = TAB_SCENE_OPACITY;
    expect(inputRange).toHaveLength(outputRange.length);
    // Increasing input, symmetric around the focused scene.
    expect([...inputRange].sort((a, b) => a - b)).toEqual(inputRange);
    expect(inputRange.map((x) => (x === 0 ? 0 : -x)).reverse()).toEqual(inputRange);
    expect(outputRange).toEqual([...outputRange].reverse());
    const at = (p: number) => outputRange[inputRange.indexOf(p)];
    expect(at(-1)).toBe(0);
    expect(at(1)).toBe(0);
    expect(at(0)).toBe(1);
    // Just off the edge a moving scene is at the start opacity.
    expect(outputRange[1]).toBe(SLIDE_START_OPACITY);
    expect(inputRange[1]).toBeGreaterThan(-1);
  });
});
