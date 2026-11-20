import { emptySetLineup } from '@/domain/lineup';

import { resolveSet, setNumbersOf } from '../params';
import { swipeStep, SWIPE_THRESHOLD } from '../swipe';

describe('swipeStep', () => {
  it('left = next, right = previous, short = nothing', () => {
    expect(swipeStep(-SWIPE_THRESHOLD)).toBe(1);
    expect(swipeStep(SWIPE_THRESHOLD + 1)).toBe(-1);
    expect(swipeStep(10)).toBe(0);
    expect(swipeStep(-10)).toBe(0);
  });
});

describe('resolveSet', () => {
  const sets = [emptySetLineup(1), emptySetLineup(3)];
  it('finds the requested set, else falls back to the first', () => {
    expect(resolveSet('3', sets)?.setNumber).toBe(3);
    expect(resolveSet(['3', '1'], sets)?.setNumber).toBe(3);
    expect(resolveSet('2', sets)?.setNumber).toBe(1);
    expect(resolveSet(undefined, sets)?.setNumber).toBe(1);
    expect(resolveSet('1', [])).toBeUndefined();
    expect(setNumbersOf(sets)).toEqual([1, 3]);
  });
});
