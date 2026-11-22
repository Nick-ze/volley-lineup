import {
  SLIDE_FALLBACK_DISTANCE,
  SLIDE_START_OPACITY,
  TAB_SCENE_OPACITY,
  SLIDE_MAX_DISTANCE,
  TAB_SWIPE_DISTANCE,
  TAB_SWIPE_VELOCITY,
  slideDirection,
  slideOffset,
  stepTab,
  swipeTabStep,
  swipeTarget,
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

describe('swipeTabStep', () => {
  it('goes to the next tab on a swipe left, the previous on a swipe right', () => {
    expect(swipeTabStep(-TAB_SWIPE_DISTANCE, 0)).toBe(1);
    expect(swipeTabStep(TAB_SWIPE_DISTANCE + 10, 0)).toBe(-1);
  });

  it('ignores short, slow swipes', () => {
    expect(swipeTabStep(-30, -100)).toBe(0);
    expect(swipeTabStep(0, 0)).toBe(0);
  });

  it('accepts a short flick in the same direction only', () => {
    expect(swipeTabStep(-30, -TAB_SWIPE_VELOCITY)).toBe(1);
    expect(swipeTabStep(30, TAB_SWIPE_VELOCITY)).toBe(-1);
    expect(swipeTabStep(30, -TAB_SWIPE_VELOCITY)).toBe(0);
    expect(swipeTabStep(0, TAB_SWIPE_VELOCITY)).toBe(0);
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

describe('swipeTarget', () => {
  const tabs = ['roster', 'matches', 'stats'] as const;
  it('returns the index of the neighbouring tab or null', () => {
    expect(swipeTarget(tabs, 'roster', -100, 0)).toBe(1);
    expect(swipeTarget(tabs, 'matches', 100, 0)).toBe(0);
    expect(swipeTarget(tabs, 'stats', -100, 0)).toBeNull();
    expect(swipeTarget(tabs, 'roster', -10, 0)).toBeNull();
  });

  it('works with null entries (the "all sets" filter)', () => {
    expect(swipeTarget([null, 1, 2], null, -100, 0)).toBe(1);
    expect(swipeTarget([null, 1, 2], 1, 100, 0)).toBe(0);
    expect(swipeTarget([1, 2, null], 2, -100, 0)).toBe(2);
    expect(swipeTarget([1, 2, null], null, -100, 0)).toBeNull();
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
