import { emptySetLineup } from './lineup';
import {
  applyLiberoSwaps,
  findLiberoSwap,
  suggestLiberoReplaces,
  withSuggestedLiberoReplaces,
} from './liberoSwap';
import { getRotation, type RotationNumber, type Slots } from './rotation';
import type { Player, Position, SetLineup } from './types';

const player = (id: string, number: number, positions: Position[]): Player => ({
  id,
  teamId: 't',
  firstName: id,
  lastName: id,
  number,
  positions,
  active: true,
});

const players: Player[] = [
  player('s', 1, ['S']),
  player('oh1', 2, ['OH']),
  player('mb1', 3, ['MB']),
  player('opp', 4, ['OPP']),
  player('oh2', 5, ['OH']),
  player('mb2', 6, ['MB', 'OPP']),
  player('lib', 7, ['L']),
  player('dsmb', 8, ['DS', 'MB']),
];

/** Standard 5-1 start: S 1, OH 2, MB 3, OPP 4, OH 5, MB 6. */
const start: Slots = { 1: 's', 2: 'oh1', 3: 'mb1', 4: 'opp', 5: 'oh2', 6: 'mb2' };
const middles = ['mb1', 'mb2'];

describe('applyLiberoSwaps — all 6 rotations (position 1 serves)', () => {
  const expected: Record<RotationNumber, Slots> = {
    // mb2 at 6 (back middle) → libero.
    1: { 1: 's', 2: 'oh1', 3: 'mb1', 4: 'opp', 5: 'oh2', 6: 'lib' },
    // Clockwise: mb2 moved 6 → 5 (back left) → libero.
    2: { 1: 'oh1', 2: 'mb1', 3: 'opp', 4: 'oh2', 5: 'lib', 6: 's' },
    // mb1 is serving at position 1: the libero may not serve, so no swap; mb2 is front row.
    3: { 1: 'mb1', 2: 'opp', 3: 'oh2', 4: 'mb2', 5: 's', 6: 'oh1' },
    // mb1 moved 1 → 6 → libero.
    4: { 1: 'opp', 2: 'oh2', 3: 'mb2', 4: 's', 5: 'oh1', 6: 'lib' },
    // mb1 at 5 → libero.
    5: { 1: 'oh2', 2: 'mb2', 3: 's', 4: 'oh1', 5: 'lib', 6: 'opp' },
    // mb2 is serving at position 1: no swap; mb1 is front row.
    6: { 1: 'mb2', 2: 's', 3: 'oh1', 4: 'mb1', 5: 'opp', 6: 'oh2' },
  };

  it.each([1, 2, 3, 4, 5, 6] as const)('rotation %i', (n) => {
    const rotated = getRotation(start, n);
    expect(applyLiberoSwaps(rotated, 'lib', middles)).toEqual(expected[n]);
  });

  it('never puts the libero at the serving position 1 in any rotation', () => {
    for (const n of [1, 2, 3, 4, 5, 6] as const) {
      const slots = applyLiberoSwaps(getRotation(start, n), 'lib', ['s', 'oh1', 'mb1', 'opp']);
      expect(slots[1]).not.toBe('lib');
    }
  });

  it('never puts the libero in the front row', () => {
    for (const n of [1, 2, 3, 4, 5, 6] as const) {
      const slots = applyLiberoSwaps(getRotation(start, n), 'lib', middles);
      expect([slots[2], slots[3], slots[4]]).not.toContain('lib');
    }
  });
});

describe('applyLiberoSwaps — receiving (position 1 not serving)', () => {
  it('may replace the player at position 1', () => {
    const rotated = getRotation(start, 3);
    expect(applyLiberoSwaps(rotated, 'lib', middles, { serving: false })).toEqual({
      1: 'lib',
      2: 'opp',
      3: 'oh2',
      4: 'mb2',
      5: 's',
      6: 'oh1',
    });
  });
});

describe('applyLiberoSwaps — edge cases', () => {
  it('returns the same slots without a libero, without choices, or with nobody in the back row', () => {
    expect(applyLiberoSwaps(start, null, middles)).toBe(start);
    expect(applyLiberoSwaps(start, 'lib', [])).toBe(start);
    expect(applyLiberoSwaps(start, 'lib', ['oh1'])).toBe(start);
  });

  it('does nothing when the libero is (invalidly) on court', () => {
    const slots: Slots = { ...start, 2: 'lib' };
    expect(applyLiberoSwaps(slots, 'lib', middles)).toBe(slots);
  });

  it('replaces only one player: the first listed one in the back row', () => {
    expect(applyLiberoSwaps(start, 'lib', ['oh2', 'mb2'])).toEqual({ ...start, 5: 'lib' });
    expect(applyLiberoSwaps(start, 'lib', ['mb2', 'oh2'])).toEqual({ ...start, 6: 'lib' });
  });

  it('does not mutate the input', () => {
    const copy = { ...start };
    applyLiberoSwaps(start, 'lib', middles);
    expect(start).toEqual(copy);
  });
});

describe('findLiberoSwap', () => {
  it('reports the position and the replaced starter', () => {
    expect(findLiberoSwap(start, 'lib', middles)).toEqual({ position: 6, replacedId: 'mb2' });
    expect(findLiberoSwap(getRotation(start, 3), 'lib', middles)).toBeNull();
    expect(findLiberoSwap(getRotation(start, 3), 'lib', middles, { serving: false })).toEqual({
      position: 1,
      replacedId: 'mb1',
    });
    expect(findLiberoSwap(start, null, middles)).toBeNull();
  });
});

const setWith = (slots: Slots, liberoId: string | null = 'lib'): SetLineup => ({
  ...emptySetLineup(1),
  slots,
  liberoId,
});

describe('suggestLiberoReplaces', () => {
  it('suggests the starters whose primary position is MB, in court order', () => {
    expect(suggestLiberoReplaces(setWith(start), players)).toEqual(['mb1', 'mb2']);
  });

  it('goes by spot role (v6): whoever stands on the MB spots of the formation', () => {
    // A DS on the MB spot 3 is suggested.
    expect(suggestLiberoReplaces(setWith({ ...start, 3: 'dsmb' }), players)).toEqual([
      'dsmb',
      'mb2',
    ]);
    // Setter spot at 2 (players unchanged): S 2 · OH 3 · MB 4 · OPP 5 · OH 6 · MB 1.
    const shifted = {
      ...setWith(start),
      formation: { system: '5-1' as const, order: 'outside' as const, setterAt: 2 as const },
    };
    expect(suggestLiberoReplaces(shifted, players)).toEqual(['s', 'opp']);
  });

  it('ignores primary MBs off the MB spots, empty MB spots and unknown players', () => {
    // MB spots 3 (unknown) and 6 (mb1); mb2 stands on the OPP spot 4, spot 2 is empty.
    const slots: Slots = { 1: 'dsmb', 2: null, 3: 'ghost', 4: 'mb2', 5: null, 6: 'mb1' };
    expect(suggestLiberoReplaces(setWith(slots), players)).toEqual(['mb1']);
    expect(suggestLiberoReplaces(setWith({ ...slots, 6: null }), players)).toEqual([]);
  });
});

describe('withSuggestedLiberoReplaces', () => {
  const noLibero = setWith(start, null);

  it('fills in the middles when a libero is assigned to a set that had none', () => {
    const next = setWith(start);
    expect(withSuggestedLiberoReplaces(noLibero, next, players).liberoReplaces).toEqual([
      'mb1',
      'mb2',
    ]);
  });

  it('leaves the set alone in every other case', () => {
    const withLibero = setWith(start);
    // Libero already there before.
    expect(withSuggestedLiberoReplaces(withLibero, withLibero, players)).toBe(withLibero);
    // Still no libero.
    expect(withSuggestedLiberoReplaces(noLibero, noLibero, players)).toBe(noLibero);
    // A choice is already made.
    const chosen = { ...withLibero, liberoReplaces: ['oh1'] };
    expect(withSuggestedLiberoReplaces(noLibero, chosen, players)).toBe(chosen);
    // No middles on court.
    const noMiddles = setWith({ ...start, 3: null, 6: null });
    expect(withSuggestedLiberoReplaces(noLibero, noMiddles, players)).toBe(noMiddles);
  });
});
