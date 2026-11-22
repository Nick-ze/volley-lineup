import { rotationStep, sameSpots, shiftPosition, spotMoves, type SpotKeys } from './courtMotion';
import { rotateBy } from './rotation';

const full: SpotKeys = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' };
const clockwise = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 1 };

describe('shiftPosition', () => {
  it('wraps around 1…6 both ways', () => {
    expect(shiftPosition(6, 1)).toBe(1);
    expect(shiftPosition(1, -1)).toBe(6);
    expect(shiftPosition(2, 3)).toBe(5);
    expect(shiftPosition(3, 12)).toBe(3);
  });
});

describe('sameSpots', () => {
  it('compares every spot', () => {
    expect(sameSpots(full, { ...full })).toBe(true);
    expect(sameSpots(full, { ...full, 3: null })).toBe(false);
  });
});

describe('spotMoves', () => {
  it.each([1, 2, 3, 4, 5, 6])('slides every player from rotation %i one spot clockwise', (n) => {
    const before = rotateBy(full, n - 1);
    const after = rotateBy(full, n);
    // Clockwise: the player at 2 goes to 1, 3 to 2, … 1 to 6.
    expect(spotMoves(before, after)).toEqual(clockwise);
  });

  it('slides counter-clockwise too', () => {
    expect(spotMoves(full, rotateBy(full, -1))).toEqual({ 1: 6, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 });
  });

  it('slides empty spots along with the rotation', () => {
    const before: SpotKeys = { ...full, 4: null, 5: null };
    expect(spotMoves(before, rotateBy(before, 1))).toEqual(clockwise);
  });

  it('lets a libero coming on appear instead of sliding', () => {
    // After the rotation the libero "L" stands in for the player now at 5 ("f", was at 6).
    const after = { ...rotateBy(full, 1), 5: 'L' };
    const moves = spotMoves(full, after);
    expect(moves[5]).toBeUndefined();
    expect(moves[1]).toBe(2);
    expect(Object.keys(moves)).toHaveLength(5);
  });

  it('is nothing for no change, a drop, a swap or a substitution', () => {
    expect(spotMoves(full, full)).toEqual({});
    // Drop on an empty spot: one player moved.
    expect(spotMoves({ ...full, 6: null }, { ...full, 1: null, 6: 'a' })).toEqual({});
    // Swap of neighbours.
    expect(spotMoves(full, { ...full, 1: 'b', 2: 'a' })).toEqual({});
    // Swap across the court (both by 3 spots).
    expect(spotMoves(full, { ...full, 1: 'd', 4: 'a' })).toEqual({});
    // Substitution.
    expect(spotMoves(full, { ...full, 3: 'x' })).toEqual({});
  });

  it('accepts a jump of several rotations', () => {
    expect(rotationStep(full, rotateBy(full, 3))).toBe(3);
    expect(spotMoves(full, rotateBy(full, 2))[1]).toBe(3);
  });

  it('needs a clear majority for one step', () => {
    // Two players moved by 1, two others by 5: no majority.
    const after: SpotKeys = { 1: 'b', 2: 'a', 3: 'd', 4: 'c', 5: 'e', 6: 'f' };
    expect(rotationStep(full, after)).toBeNull();
  });
});
