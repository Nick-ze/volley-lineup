import {
  BACK_ROW_POSITIONS,
  FRONT_ROW_POSITIONS,
  getAllRotations,
  getRotation,
  isBackRow,
  isFrontRow,
  isRotationNumber,
  nextPositionClockwise,
  nextRotation,
  oppositePosition,
  previousRotation,
  ROTATION_NUMBERS,
  rotateBy,
  rotateClockwise,
  serverPosition,
  type Slots,
} from './rotation';

/** Start lineup: player "pN" starts at position N. */
const start: Slots = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };

describe('constants and row helpers', () => {
  it('defines front row 2,3,4 and back row 1,5,6 with the server at 1', () => {
    expect(FRONT_ROW_POSITIONS).toEqual([2, 3, 4]);
    expect(BACK_ROW_POSITIONS).toEqual([1, 5, 6]);
    expect(serverPosition).toBe(1);
  });

  it.each([
    [1, false],
    [2, true],
    [3, true],
    [4, true],
    [5, false],
    [6, false],
  ] as const)('isFrontRow(%i) is %s', (pos, front) => {
    expect(isFrontRow(pos)).toBe(front);
    expect(isBackRow(pos)).toBe(!front);
  });

  it.each([
    [1, 4],
    [2, 5],
    [3, 6],
    [4, 1],
    [5, 2],
    [6, 3],
  ] as const)('oppositePosition(%i) = %i', (pos, opp) => {
    expect(oppositePosition(pos)).toBe(opp);
  });

  it('recognises valid rotation numbers only', () => {
    expect(ROTATION_NUMBERS.every(isRotationNumber)).toBe(true);
    for (const bad of [0, 7, -1, 1.5, NaN, '1', null, undefined]) {
      expect(isRotationNumber(bad)).toBe(false);
    }
  });
});

describe('clockwise rule (PLAN §4: 2→1, 3→2, 4→3, 5→4, 6→5, 1→6)', () => {
  it.each([
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 5],
    [1, 6],
  ] as const)('a player at %i moves to %i', (from, to) => {
    expect(nextPositionClockwise(from)).toBe(to);
    const rotated = rotateClockwise(start);
    expect(rotated[to]).toBe(`p${from}`);
  });

  it('does not mutate the input', () => {
    const copy = { ...start };
    rotateClockwise(start);
    expect(start).toEqual(copy);
  });

  it('keeps empty slots empty and moves them like players', () => {
    const partial: Slots = { 1: 'p1', 2: null, 3: 'p3', 4: null, 5: null, 6: null };
    expect(rotateClockwise(partial)).toEqual({
      1: null,
      2: 'p3',
      3: null,
      4: null,
      5: null,
      6: 'p1',
    });
    const empty: Slots = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
    expect(getAllRotations(empty).every((r) => Object.values(r).every((v) => v === null))).toBe(
      true,
    );
  });
});

describe('getRotation — all six rotations explicitly', () => {
  it('rotation 1 is the starting lineup', () => {
    expect(getRotation(start, 1)).toEqual(start);
  });
  it('rotation 2', () => {
    expect(getRotation(start, 2)).toEqual({ 1: 'p2', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6', 6: 'p1' });
  });
  it('rotation 3', () => {
    expect(getRotation(start, 3)).toEqual({ 1: 'p3', 2: 'p4', 3: 'p5', 4: 'p6', 5: 'p1', 6: 'p2' });
  });
  it('rotation 4', () => {
    expect(getRotation(start, 4)).toEqual({ 1: 'p4', 2: 'p5', 3: 'p6', 4: 'p1', 5: 'p2', 6: 'p3' });
  });
  it('rotation 5', () => {
    expect(getRotation(start, 5)).toEqual({ 1: 'p5', 2: 'p6', 3: 'p1', 4: 'p2', 5: 'p3', 6: 'p4' });
  });
  it('rotation 6', () => {
    expect(getRotation(start, 6)).toEqual({ 1: 'p6', 2: 'p1', 3: 'p2', 4: 'p3', 5: 'p4', 6: 'p5' });
  });

  it('each player serves exactly once across the six rotations, in order 1,2,3,4,5,6', () => {
    expect(getAllRotations(start).map((r) => r[serverPosition])).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
    ]);
  });

  it.each([0, 7, -1, 2.5, NaN])('rejects invalid rotation %p', (n) => {
    expect(() => getRotation(start, n)).toThrow(RangeError);
  });
});

describe('rotateBy and wrap-around', () => {
  it('six clockwise rotations return to the start (rotation 7 ≡ rotation 1)', () => {
    let r = start;
    for (let i = 0; i < 6; i += 1) r = rotateClockwise(r);
    expect(r).toEqual(start);
    expect(rotateBy(start, 6)).toEqual(start);
    expect(rotateBy(start, 12)).toEqual(start);
    expect(rotateBy(start, 0)).toEqual(start);
  });

  it('rotateBy(n - 1) matches getRotation(n) and wraps beyond 6', () => {
    for (const n of ROTATION_NUMBERS) {
      expect(rotateBy(start, n - 1)).toEqual(getRotation(start, n));
      expect(rotateBy(start, n - 1 + 6)).toEqual(getRotation(start, n));
    }
  });

  it('negative steps rotate back', () => {
    expect(rotateBy(start, -1)).toEqual(getRotation(start, 6));
    expect(rotateBy(rotateClockwise(start), -1)).toEqual(start);
  });

  it('rejects non-integer steps', () => {
    expect(() => rotateBy(start, 1.5)).toThrow(RangeError);
  });

  it('getAllRotations returns six entries, the first being the start', () => {
    const all = getAllRotations(start);
    expect(all).toHaveLength(6);
    expect(all[0]).toEqual(start);
    expect(all[5]).toEqual(getRotation(start, 6));
  });
});

describe('nextRotation / previousRotation', () => {
  it('steps forward and wraps 6 → 1', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => nextRotation(n as 1))).toEqual([2, 3, 4, 5, 6, 1]);
  });
  it('steps back and wraps 1 → 6', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => previousRotation(n as 1))).toEqual([6, 1, 2, 3, 4, 5]);
  });
});
