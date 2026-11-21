import { emptySetLineup } from './lineup';
import {
  benchPlayers,
  clearLineup,
  copyLineup,
  findSlot,
  hitTest,
  lineupForSet,
  locatePlayer,
  movePlayer,
  parseSetNumber,
  placePlayer,
  pruneLiberoReplaces,
  previousSet,
  removeFromCourt,
  removePlayer,
  setLibero,
  setLiberoReplaces,
  setServeFirst,
  swapSlots,
  tapPlayer,
  tapTarget,
  toggleLiberoReplace,
} from './lineupEditing';
import { COURT_POSITIONS, type Player, type SetLineup } from './types';

const player = (id: string, number: number, active = true): Player => ({
  id,
  teamId: 't',
  firstName: id,
  lastName: id,
  number,
  positions: ['OH'],
  active,
});

/** Counts how often each player id appears in a set (slots + libero). */
function occurrences(set: SetLineup): Record<string, number> {
  const out: Record<string, number> = {};
  const ids = [...COURT_POSITIONS.map((p) => set.slots[p]), set.liberoId];
  ids.forEach((id) => {
    if (id) out[id] = (out[id] ?? 0) + 1;
  });
  return out;
}

const base = (): SetLineup => {
  const s = emptySetLineup(1);
  return { ...s, slots: { ...s.slots, 1: 'a', 2: 'b' }, liberoId: 'l' };
};

describe('findSlot / locatePlayer', () => {
  it('finds a player on court, as libero, or on the bench', () => {
    const s = base();
    expect(findSlot(s, 'b')).toBe(2);
    expect(findSlot(s, 'x')).toBeNull();
    expect(locatePlayer(s, 'a')).toEqual({ kind: 'slot', position: 1 });
    expect(locatePlayer(s, 'l')).toEqual({ kind: 'libero' });
    expect(locatePlayer(s, 'x')).toEqual({ kind: 'bench' });
  });
});

describe('placePlayer', () => {
  it('places a bench player on an empty slot without mutating the input', () => {
    const s = base();
    const next = placePlayer(s, 'c', 3);
    expect(next.slots[3]).toBe('c');
    expect(s.slots[3]).toBeNull();
  });

  it('replaces the occupant of a slot (occupant goes to the bench)', () => {
    const next = placePlayer(base(), 'c', 1);
    expect(next.slots[1]).toBe('c');
    expect(findSlot(next, 'a')).toBeNull();
  });

  it('moves a player already on court instead of duplicating (swap with occupant)', () => {
    const next = placePlayer(base(), 'a', 2);
    expect(next.slots[2]).toBe('a');
    expect(next.slots[1]).toBe('b');
    expect(occurrences(next)).toEqual({ a: 1, b: 1, l: 1 });
  });

  it('moves a player to an empty slot, leaving the old slot empty', () => {
    const next = placePlayer(base(), 'a', 5);
    expect(next.slots[5]).toBe('a');
    expect(next.slots[1]).toBeNull();
  });

  it('clears the libero when the libero is placed on court', () => {
    const next = placePlayer(base(), 'l', 4);
    expect(next.slots[4]).toBe('l');
    expect(next.liberoId).toBeNull();
  });

  it('returns the same object when placing a player on their own slot', () => {
    const s = base();
    expect(placePlayer(s, 'a', 1)).toBe(s);
  });
});

describe('swapSlots / removeFromCourt / removePlayer', () => {
  it('swaps two slots, including with an empty one', () => {
    const s = swapSlots(base(), 1, 2);
    expect([s.slots[1], s.slots[2]]).toEqual(['b', 'a']);
    const e = swapSlots(base(), 1, 6);
    expect([e.slots[1], e.slots[6]]).toEqual([null, 'a']);
  });

  it('removes from a court position', () => {
    expect(removeFromCourt(base(), 1).slots[1]).toBeNull();
  });

  it('removes a player from anywhere', () => {
    expect(removePlayer(base(), 'a').slots[1]).toBeNull();
    expect(removePlayer(base(), 'l').liberoId).toBeNull();
    const s = base();
    expect(removePlayer(s, 'x')).toBe(s);
  });
});

describe('setLibero', () => {
  it('sets a bench player as libero', () => {
    expect(setLibero(base(), 'c').liberoId).toBe('c');
  });

  it('takes a court player off the court', () => {
    const next = setLibero(base(), 'a');
    expect(next.liberoId).toBe('a');
    expect(next.slots[1]).toBeNull();
    expect(occurrences(next)).toEqual({ a: 1, b: 1 });
  });

  it('clears the libero with null', () => {
    expect(setLibero(base(), null).liberoId).toBeNull();
  });
});

describe('movePlayer (shared drop logic)', () => {
  it('moves to a slot', () => {
    expect(movePlayer(base(), 'c', { kind: 'slot', position: 6 }).slots[6]).toBe('c');
  });

  it('moves to the libero spot (and is a no-op for the current libero)', () => {
    expect(movePlayer(base(), 'b', { kind: 'libero' }).liberoId).toBe('b');
    const s = base();
    expect(movePlayer(s, 'l', { kind: 'libero' })).toBe(s);
  });

  it('moves to the bench', () => {
    expect(movePlayer(base(), 'a', { kind: 'bench' }).slots[1]).toBeNull();
    expect(movePlayer(base(), 'l', { kind: 'bench' }).liberoId).toBeNull();
  });

  it('never puts a player in two places, whatever the sequence', () => {
    let s = base();
    const ids = ['a', 'b', 'c', 'l'];
    const targets = [
      ...COURT_POSITIONS.map((position) => ({ kind: 'slot' as const, position })),
      { kind: 'libero' as const },
      { kind: 'bench' as const },
    ];
    for (let i = 0; i < 200; i += 1) {
      s = movePlayer(s, ids[i % ids.length], targets[(i * 7) % targets.length]);
      Object.values(occurrences(s)).forEach((n) => expect(n).toBe(1));
    }
  });
});

describe('serve, clear, copy', () => {
  it('sets who serves first', () => {
    expect(setServeFirst(base(), false).weServeFirst).toBe(false);
  });

  it('clears the lineup but keeps set number and serve', () => {
    const s = { ...base(), setNumber: 3 as const, weServeFirst: false };
    expect(clearLineup(s)).toEqual({ ...emptySetLineup(3), weServeFirst: false });
  });

  it('copies slots and libero to another set number', () => {
    const from = base();
    const copy = copyLineup(from, 2);
    expect(copy).toEqual({ ...from, setNumber: 2 });
    expect(copy.slots).not.toBe(from.slots);
  });

  it('keeps an explicit serve choice when copying', () => {
    expect(copyLineup(base(), 2, false).weServeFirst).toBe(false);
  });
});

describe('benchPlayers', () => {
  it('lists active players not on court and not libero, by number', () => {
    const players = [
      player('c', 9),
      player('a', 1),
      player('l', 2),
      player('d', 3),
      player('x', 4, false),
      player('b', 7),
    ];
    expect(benchPlayers(base(), players).map((p) => p.id)).toEqual(['d', 'c']);
  });

  it('works without a libero', () => {
    const s = { ...base(), liberoId: null };
    expect(benchPlayers(s, [player('l', 2)]).map((p) => p.id)).toEqual(['l']);
  });
});

describe('lineupForSet / previousSet', () => {
  const sets = [base(), { ...emptySetLineup(2), weServeFirst: false }];

  it('returns the existing set or an empty one', () => {
    expect(lineupForSet(sets, 2).weServeFirst).toBe(false);
    expect(lineupForSet(sets, 4)).toEqual(emptySetLineup(4));
  });

  it('returns the nearest earlier stored set', () => {
    expect(previousSet(sets, 2)?.setNumber).toBe(1);
    expect(previousSet(sets, 1)).toBeNull();
    expect(previousSet(sets, 4)?.setNumber).toBe(2);
    const unordered = [sets[1], { ...emptySetLineup(3) }, sets[0]];
    expect(previousSet(unordered, 5)?.setNumber).toBe(3);
    expect(previousSet([emptySetLineup(3)], 2)).toBeNull();
  });
});

describe('tapPlayer / tapTarget (tap-to-select)', () => {
  it('selects, then deselects the same player', () => {
    const s = base();
    expect(tapPlayer(s, null, 'c')).toEqual({ set: s, selectedId: 'c' });
    expect(tapPlayer(s, 'c', 'c')).toEqual({ set: s, selectedId: null });
  });

  it('switches selection between two bench players', () => {
    const s = base();
    expect(tapPlayer(s, 'c', 'd')).toEqual({ set: s, selectedId: 'd' });
  });

  it('puts a tapped bench player in the selected court player’s place', () => {
    const r = tapPlayer(base(), 'a', 'c');
    expect(r.set.slots[1]).toBe('c');
    expect(findSlot(r.set, 'a')).toBeNull();
    expect(r.selectedId).toBeNull();
    expect(tapPlayer(base(), 'l', 'c').set.liberoId).toBe('c');
  });

  it('moves the selected player onto a tapped court player (swap)', () => {
    const r = tapPlayer(base(), 'a', 'b');
    expect([r.set.slots[1], r.set.slots[2]]).toEqual(['b', 'a']);
    expect(tapPlayer(base(), 'c', 'l').set.liberoId).toBe('c');
  });

  it('moves the selected player to a tapped target, or does nothing without selection', () => {
    const s = base();
    expect(tapTarget(s, null, { kind: 'slot', position: 3 })).toEqual({ set: s, selectedId: null });
    const r = tapTarget(s, 'c', { kind: 'slot', position: 3 });
    expect(r.set.slots[3]).toBe('c');
    expect(r.selectedId).toBeNull();
  });
});

describe('hitTest', () => {
  const zones = [
    { key: 'a', x: 0, y: 0, width: 100, height: 100 },
    { key: 'b', x: 50, y: 50, width: 100, height: 100 },
  ];
  it('finds the zone under a point, preferring later zones', () => {
    expect(hitTest(zones, 10, 10)).toBe('a');
    expect(hitTest(zones, 60, 60)).toBe('b');
    expect(hitTest(zones, 150, 150)).toBe('b');
    expect(hitTest(zones, 151, 10)).toBeNull();
    expect(hitTest(zones, 10, 120)).toBeNull();
  });
});

describe('parseSetNumber', () => {
  it('accepts 1–5 and falls back to 1', () => {
    expect(parseSetNumber('3')).toBe(3);
    expect(parseSetNumber(['5', '2'])).toBe(5);
    expect(parseSetNumber(undefined)).toBe(1);
    expect(parseSetNumber('7')).toBe(1);
    expect(parseSetNumber('abc')).toBe(1);
  });
});

describe('no-op operations return the same object (nothing to save)', () => {
  it('covers swap, remove, libero, serve and clear', () => {
    const s = base();
    expect(swapSlots(s, 3, 3)).toBe(s);
    expect(swapSlots(s, 3, 4)).toBe(s); // both empty
    expect(removeFromCourt(s, 3)).toBe(s);
    expect(setLibero(s, 'l')).toBe(s);
    expect(setServeFirst(s, true)).toBe(s);
    expect(movePlayer(s, 'x', { kind: 'bench' })).toBe(s);
    expect(movePlayer(s, 'a', { kind: 'slot', position: 1 })).toBe(s);
    const empty = emptySetLineup(2);
    expect(clearLineup(empty)).toBe(empty);
    expect(setLibero(empty, null)).toBe(empty);
    const onlyLibero = { ...empty, liberoId: 'l' };
    expect(clearLineup(onlyLibero).liberoId).toBeNull();
  });
});

describe('liberoReplaces stays limited to players on court', () => {
  /** a at 1, b at 2, c at 3; the libero replaces a and c. */
  const withChoice = (): SetLineup => {
    const s = base();
    return { ...s, slots: { ...s.slots, 3: 'c' }, liberoReplaces: ['a', 'c'] };
  };

  it('pruneLiberoReplaces drops players who are not on court', () => {
    const s = { ...withChoice(), liberoReplaces: ['a', 'x', 'c'] };
    expect(pruneLiberoReplaces(s).liberoReplaces).toEqual(['a', 'c']);
    const ok = withChoice();
    expect(pruneLiberoReplaces(ok)).toBe(ok);
  });

  it('removing a player to the bench removes them from liberoReplaces', () => {
    expect(removePlayer(withChoice(), 'a').liberoReplaces).toEqual(['c']);
    expect(movePlayer(withChoice(), 'c', { kind: 'bench' }).liberoReplaces).toEqual(['a']);
  });

  it('emptying a court position removes that player', () => {
    expect(removeFromCourt(withChoice(), 3).liberoReplaces).toEqual(['a']);
  });

  it('replacing a starter with a bench player removes the replaced starter', () => {
    expect(placePlayer(withChoice(), 'd', 1).liberoReplaces).toEqual(['c']);
  });

  it('making a starter the libero removes them', () => {
    expect(setLibero(withChoice(), 'c').liberoReplaces).toEqual(['a']);
  });

  it('moving or swapping players on court keeps the choice', () => {
    expect(placePlayer(withChoice(), 'a', 5).liberoReplaces).toEqual(['a', 'c']);
    expect(swapSlots(withChoice(), 1, 3).liberoReplaces).toEqual(['a', 'c']);
  });

  it('clearing the lineup clears the choice', () => {
    expect(clearLineup(withChoice()).liberoReplaces).toEqual([]);
  });
});

describe('setLiberoReplaces / toggleLiberoReplace', () => {
  const s = (): SetLineup => ({ ...base(), liberoReplaces: ['a'] });

  it('sets the choice, ignoring players off court and duplicates', () => {
    expect(setLiberoReplaces(s(), ['b', 'x', 'b', 'a']).liberoReplaces).toEqual(['b', 'a']);
    expect(setLiberoReplaces(s(), []).liberoReplaces).toEqual([]);
  });

  it('returns the same object when nothing changes', () => {
    const set = s();
    expect(setLiberoReplaces(set, ['a'])).toBe(set);
    expect(setLiberoReplaces(set, ['a', 'x'])).toBe(set);
  });

  it('toggles one starter in and out', () => {
    const added = toggleLiberoReplace(s(), 'b');
    expect(added.liberoReplaces).toEqual(['a', 'b']);
    expect(toggleLiberoReplace(added, 'a').liberoReplaces).toEqual(['b']);
    const set = s();
    expect(toggleLiberoReplace(set, 'x')).toBe(set);
  });
});
