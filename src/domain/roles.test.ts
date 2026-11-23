import { activeLiberoReplaces } from './liberoSwap';
import { emptySetLineup } from './lineup';
import {
  copyLineup,
  placePlayer,
  pruneLiberoReplaces,
  removeFromCourt,
  swapSlots,
} from './lineupEditing';
import { applyLineupEdit } from './lineupLock';
import { addPoint, addSub, liveCourtView, replaySet, replaySteps } from './liveSet';
import { applyPresetToSet, presetFromSet } from './presets';
import {
  DEFAULT_FORMATION,
  FORMATION_ORDERS,
  FORMATION_PATTERNS,
  FORMATION_SYSTEMS,
  formationRotation,
  inferFormation,
  isOffPosition,
  roleOf,
  rotateStarters,
  setFormation,
  setLiberoActive,
  setterRotation,
  spotRole,
  spotRoles,
  startersWithRoles,
  startingRoles,
  upgradeLineupToFormation,
} from './roles';
import { oppositePosition } from './rotation';
import {
  COURT_POSITIONS,
  type CourtPosition,
  type Formation,
  type Player,
  type Position,
  type SetLineup,
} from './types';

const p = (id: string, positions: Position[]): Player => ({
  id,
  teamId: 't',
  firstName: id,
  lastName: id,
  number: Number(id.slice(1)),
  positions,
  active: true,
});

// 5-1: setter p1, OH p2 + p5, MB p3 + p6, OPP p4; libero p7; bench OH p8, player without positions p9
const players = [
  p('p1', ['S']),
  p('p2', ['OH']),
  p('p3', ['MB']),
  p('p4', ['OPP', 'OH']),
  p('p5', ['OH']),
  p('p6', ['MB']),
  p('p7', ['L']),
  p('p8', ['OH']),
  p('p9', []),
];
const byId = (id: string) => players.find((x) => x.id === id) as Player;

const lineup = (over: Partial<SetLineup> = {}): SetLineup => ({
  ...emptySetLineup(1),
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  liberoReplaces: ['p3', 'p6'],
  ...over,
});

const formation = (
  system: Formation['system'],
  order: Formation['order'],
  setterAt: CourtPosition,
): Formation => ({ system, order, setterAt });

/** The six spot roles as a list, position 1 first. */
const layout = (f: Formation): Position[] => COURT_POSITIONS.map((pos) => spotRole(f, pos));

describe('formation patterns', () => {
  it('lists the systems, orders and the default formation', () => {
    expect(FORMATION_SYSTEMS).toEqual(['5-1', '6-2']);
    expect(FORMATION_ORDERS).toEqual(['outside', 'middle']);
    expect(DEFAULT_FORMATION).toEqual({ system: '5-1', order: 'outside', setterAt: 1 });
    expect(emptySetLineup(1).formation).toEqual(DEFAULT_FORMATION);
  });

  it('has the textbook layouts with the setter at 1 (docs/VOLLEYBALL_RULES.md §2)', () => {
    expect(FORMATION_PATTERNS['5-1'].outside).toEqual(['S', 'OH', 'MB', 'OPP', 'OH', 'MB']);
    expect(layout(formation('5-1', 'outside', 1))).toEqual(['S', 'OH', 'MB', 'OPP', 'OH', 'MB']);
    expect(layout(formation('5-1', 'middle', 1))).toEqual(['S', 'MB', 'OH', 'OPP', 'MB', 'OH']);
    expect(layout(formation('6-2', 'outside', 1))).toEqual(['S', 'OH', 'MB', 'S', 'OH', 'MB']);
    expect(layout(formation('6-2', 'middle', 1))).toEqual(['S', 'MB', 'OH', 'S', 'MB', 'OH']);
  });

  it('turns the layout with the setter spot (positions 1–6)', () => {
    // Setter at 4: S 4 · OH 5 · MB 6 · OPP 1 · OH 2 · MB 3.
    expect(layout(formation('5-1', 'outside', 4))).toEqual(['OPP', 'OH', 'MB', 'S', 'OH', 'MB']);
    // Setter at 6: S 6 · MB 1 · OH 2 · OPP 3 · MB 4 · OH 5.
    expect(layout(formation('5-1', 'middle', 6))).toEqual(['MB', 'OH', 'OPP', 'MB', 'OH', 'S']);
    // Setter at 2: S 2 · OH 3 · MB 4 · S 5 · OH 6 · MB 1.
    expect(layout(formation('6-2', 'outside', 2))).toEqual(['MB', 'S', 'OH', 'MB', 'S', 'OH']);
    expect(spotRoles(formation('6-2', 'middle', 3))).toEqual({
      1: 'MB',
      2: 'OH',
      3: 'S',
      4: 'MB',
      5: 'OH',
      6: 'S',
    });
  });

  it('keeps every pair opposite (S–OPP or S–S, OH–OH, MB–MB) for every setter spot', () => {
    const pairs: Record<Formation['system'], Record<string, string>> = {
      '5-1': { S: 'OPP', OPP: 'S', OH: 'OH', MB: 'MB' },
      '6-2': { S: 'S', OH: 'OH', MB: 'MB' },
    };
    for (const system of FORMATION_SYSTEMS) {
      for (const order of FORMATION_ORDERS) {
        for (const setterAt of COURT_POSITIONS) {
          const f = formation(system, order, setterAt);
          expect(spotRole(f, setterAt)).toBe('S');
          for (const pos of COURT_POSITIONS) {
            expect(spotRole(f, oppositePosition(pos))).toBe(pairs[system][spotRole(f, pos)]);
          }
        }
      }
    }
  });
});

describe('roles of players', () => {
  it('a starter plays the role of their spot; off the court no role', () => {
    const set = lineup();
    expect(roleOf(set, 'p1')).toBe('S');
    expect(roleOf(set, 'p4')).toBe('OPP');
    expect(roleOf(set, 'p8')).toBeNull(); // bench
    // the setter spot at 4: p4 sets, p1 plays opposite
    const setterAt4 = lineup({ formation: formation('5-1', 'outside', 4) });
    expect(roleOf(setterAt4, 'p4')).toBe('S');
    expect(roleOf(setterAt4, 'p1')).toBe('OPP');
  });

  it('off position = none of the player’s positions (secondary positions are fine)', () => {
    expect(isOffPosition(byId('p4'), 'OPP')).toBe(false);
    expect(isOffPosition(byId('p4'), 'OH')).toBe(false); // secondary
    expect(isOffPosition(byId('p4'), 'S')).toBe(true);
    expect(isOffPosition(byId('p9'), 'DS')).toBe(true);
    expect(isOffPosition(byId('p4'), null)).toBe(false);
  });
});

describe('roles stay with the spots while editing', () => {
  const set = lineup({ formation: formation('5-1', 'outside', 2) });

  it('swapping and moving change who plays a role, not the formation', () => {
    const swapped = swapSlots(set, 2, 4);
    expect(swapped.formation).toEqual(set.formation);
    // setter spot 2: p4 now sets, p2 on spot 4 plays MB
    expect(roleOf(swapped, 'p4')).toBe('S');
    expect(roleOf(swapped, 'p2')).toBe('MB');
    expect(placePlayer(set, 'p8', 2).formation).toEqual(set.formation);
    expect(roleOf(placePlayer(set, 'p8', 2), 'p8')).toBe('S');
  });

  it('a player leaving the court keeps the formation', () => {
    expect(removeFromCourt(set, 4).formation).toEqual(set.formation);
    expect(pruneLiberoReplaces(set)).toBe(set);
  });

  it('copies, presets and applying a preset carry the formation and the libero switch', () => {
    const off = setLiberoActive(set, false);
    expect(copyLineup(off, 2)).toMatchObject({
      formation: { system: '5-1', order: 'outside', setterAt: 2 },
      liberoActive: false,
    });
    const preset = presetFromSet(off);
    expect(preset).toMatchObject({ formation: set.formation, liberoActive: false });
    // p2 is injured: left out, the formation stays
    const roster = players.map((x) => (x.id === 'p2' ? { ...x, active: false } : x));
    const applied = applyPresetToSet(emptySetLineup(2), preset, roster);
    expect(applied.set.slots[2]).toBeNull();
    expect(applied.set.formation).toEqual({ system: '5-1', order: 'outside', setterAt: 2 });
    expect(applied.set.formation).not.toBe(preset.formation);
    expect(applied.set.liberoActive).toBe(false);
  });

  it('the formation is locked in a played set (like the starting six)', () => {
    const played = addPoint(set, 'us');
    for (const change of [
      formation('5-1', 'outside', 3),
      formation('6-2', 'outside', 2),
      formation('5-1', 'middle', 2),
    ]) {
      expect(applyLineupEdit(played, { ...played, formation: change })).toBe(played);
    }
    const unchanged = { ...played, formation: { ...played.formation } };
    expect(applyLineupEdit(played, unchanged)).toBe(unchanged);
    // the libero switch stays editable
    const off = setLiberoActive(played, false);
    expect(applyLineupEdit(played, off)).toBe(off);
  });
});

describe('setFormation', () => {
  it('changes system and/or order, keeping the setter spot', () => {
    const set = lineup({ formation: formation('5-1', 'outside', 3) });
    expect(setFormation(set, { system: '6-2' }).formation).toEqual(formation('6-2', 'outside', 3));
    expect(setFormation(set, { order: 'middle' }).formation).toEqual(formation('5-1', 'middle', 3));
    expect(setFormation(set, { system: '6-2', order: 'middle' }).formation).toEqual(
      formation('6-2', 'middle', 3),
    );
    expect(setFormation(set, { system: '6-2' }).slots).toEqual(set.slots);
  });

  it('6-2 → 5-1 keeps the back-row setter (the one the rotation is named after)', () => {
    // 6-2 with setter spots 4 (front) and 1 (back): the 5-1 setter goes to 1, not 4
    const front = lineup({ formation: formation('6-2', 'outside', 4) });
    expect(setFormation(front, { system: '5-1' }).formation).toEqual(
      formation('5-1', 'outside', 1),
    );
    // already the back-row one: unchanged
    const back = lineup({ formation: formation('6-2', 'middle', 6) });
    expect(setFormation(back, { system: '5-1' }).formation).toEqual(formation('5-1', 'middle', 6));
    // 5-1 → 6-2 keeps the spot
    const five = lineup({ formation: formation('5-1', 'outside', 2) });
    expect(setFormation(five, { system: '6-2' }).formation).toEqual(formation('6-2', 'outside', 2));
  });

  it('returns the same set when nothing changes or the set is played', () => {
    const set = lineup();
    expect(setFormation(set, {})).toBe(set);
    expect(setFormation(set, { system: '5-1', order: 'outside' })).toBe(set);
    const played = addPoint(set, 'us');
    expect(setFormation(played, { system: '6-2' })).toBe(played);
  });
});

describe('rotateStarters', () => {
  it('moves the starting six one position either way; the formation turns with them', () => {
    const set = lineup({ formation: formation('5-1', 'middle', 4) });
    const clockwise = rotateStarters(set, 'clockwise');
    expect(clockwise.slots).toEqual({ 1: 'p2', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6', 6: 'p1' });
    expect(clockwise.formation).toEqual(formation('5-1', 'middle', 3));
    const counter = rotateStarters(set, 'counterclockwise');
    expect(counter.slots).toEqual({ 1: 'p6', 2: 'p1', 3: 'p2', 4: 'p3', 5: 'p4', 6: 'p5' });
    expect(counter.formation).toEqual(formation('5-1', 'middle', 5));
    const back = rotateStarters(clockwise, 'counterclockwise');
    expect(back.slots).toEqual(set.slots);
    expect(back.formation).toEqual(set.formation);
  });

  it('wraps the setter spot (1 → 6 clockwise, 6 → 1 counter-clockwise)', () => {
    expect(rotateStarters(lineup(), 'clockwise').formation.setterAt).toBe(6);
    const at6 = lineup({ formation: formation('6-2', 'outside', 6) });
    expect(rotateStarters(at6, 'counterclockwise').formation.setterAt).toBe(1);
  });

  it('every player keeps their role, all 6 setter spots both ways', () => {
    for (const system of FORMATION_SYSTEMS) {
      for (const setterAt of COURT_POSITIONS) {
        const set = lineup({ formation: formation(system, 'outside', setterAt) });
        for (const direction of ['clockwise', 'counterclockwise'] as const) {
          const turned = rotateStarters(set, direction);
          for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
            expect(roleOf(turned, id)).toBe(roleOf(set, id));
          }
        }
      }
    }
  });

  it('does nothing once the set is played', () => {
    const played = addPoint(lineup(), 'us');
    expect(rotateStarters(played, 'clockwise')).toBe(played);
  });
});

describe('libero on/off and whom it replaces by role', () => {
  it('a switched-off libero replaces nobody', () => {
    const set = lineup();
    expect(activeLiberoReplaces(set)).toEqual(['p3', 'p6']);
    const off = setLiberoActive(set, false);
    expect(activeLiberoReplaces(off)).toEqual([]);
    expect(setLiberoActive(off, false)).toBe(off);
    // rotation 1 with us serving: p6 (MB) at position 6 is swapped only while the libero is on
    const state = replaySet(set, players);
    expect(liveCourtView(set, state).liberoSwap).toEqual({ position: 6, replacedId: 'p6' });
    expect(liveCourtView(off, replaySet(off, players)).liberoSwap).toBeNull();
  });

  it('finds the starters on the spots with given roles', () => {
    const set = lineup();
    expect(startersWithRoles(set, players, ['MB'])).toEqual(['p3', 'p6']);
    expect(startersWithRoles(set, players, ['OH'])).toEqual(['p2', 'p5']);
    expect(startersWithRoles(set, players, ['S', 'OPP'])).toEqual(['p1', 'p4']);
    expect(startersWithRoles(set, players, ['DS'])).toEqual([]);
    // 'middle' order: the MB spots are 2 and 5
    const middle = lineup({ formation: formation('5-1', 'middle', 1) });
    expect(startersWithRoles(middle, players, ['MB'])).toEqual(['p2', 'p5']);
    const withUnknown = lineup({ slots: { ...set.slots, 6: 'ghost' } });
    expect(startersWithRoles(withUnknown, players, ['MB'])).toEqual(['p3']);
    const withEmpty = lineup({ slots: { ...set.slots, 6: null } });
    expect(startersWithRoles(withEmpty, players, ['MB'])).toEqual(['p3']);
  });
});

describe('setter rotation', () => {
  it('is the setter’s position; the back-row setter counts with two', () => {
    const slots = lineup().slots;
    expect(setterRotation(slots, { p1: 'S' })).toBe(1);
    expect(setterRotation(slots, { p4: 'S' })).toBe(4);
    expect(setterRotation(slots, { p1: 'S', p4: 'S' })).toBe(1); // 6-2: back-row setter
    expect(setterRotation(slots, { p2: 'S', p4: 'S' })).toBe(2); // both front: lowest position
    expect(setterRotation(slots, { p2: 'OH' })).toBeNull();
    expect(setterRotation({ ...slots, 1: null }, { p1: 'S' })).toBeNull();
  });

  it('of a formation: the setter spot; in a 6-2 the back-row setter spot', () => {
    for (const setterAt of COURT_POSITIONS) {
      expect(formationRotation(formation('5-1', 'outside', setterAt))).toBe(setterAt);
    }
    // 6-2: setter spots 1+4 → 1, 2+5 → 5, 3+6 → 6, 4+1 → 1, 5+2 → 5, 6+3 → 6.
    expect(COURT_POSITIONS.map((at) => formationRotation(formation('6-2', 'middle', at)))).toEqual([
      1, 5, 6, 1, 5, 6,
    ]);
  });

  it('starting roles come from the spots and skip unknown players and empty spots', () => {
    const set = lineup({ slots: { 1: 'p1', 2: 'p9', 3: 'ghost', 4: 'p4', 5: null, 6: 'p6' } });
    // p9 (no positions) plays the OH of spot 2 — off position, but a role all the same.
    expect(startingRoles(set, players)).toEqual({ p1: 'S', p9: 'OH', p4: 'OPP', p6: 'MB' });
    const sixTwo = lineup({ formation: formation('6-2', 'outside', 1) });
    expect(startingRoles(sixTwo, players)).toEqual({
      p1: 'S',
      p2: 'OH',
      p3: 'MB',
      p4: 'S',
      p5: 'OH',
      p6: 'MB',
    });
  });
});

describe('inferFormation (migration from per-player roles)', () => {
  const slots = lineup().slots;

  it('without a setter: the default formation (a fresh copy)', () => {
    const noSetter = inferFormation(
      slots,
      {},
      players.filter((x) => x.id !== 'p1'),
    );
    expect(noSetter).toEqual(DEFAULT_FORMATION);
    expect(noSetter).not.toBe(DEFAULT_FORMATION);
    expect(inferFormation({ ...slots, 1: null }, {}, players)).toEqual(DEFAULT_FORMATION);
  });

  it('one setter at p: a 5-1 with the setter at p', () => {
    expect(inferFormation(slots, {}, players)).toEqual(formation('5-1', 'outside', 1));
    expect(inferFormation(slots, { p1: 'OPP', p4: 'S' }, players)).toEqual(
      formation('5-1', 'outside', 4),
    );
    // the first setter by position counts; the opposite spot 6 (MB) makes no 6-2
    expect(inferFormation(slots, { p3: 'S' }, players)).toEqual(formation('5-1', 'outside', 1));
  });

  it('two setters opposite each other: a 6-2', () => {
    expect(inferFormation(slots, { p4: 'S' }, players)).toEqual(formation('6-2', 'outside', 1));
    // two setters not opposite (1 and 3): still a 5-1
    expect(inferFormation(slots, { p1: 'S', p3: 'S' }, players).system).toBe('5-1');
  });

  it("the spot after the setter played by a middle: 'middle' order", () => {
    const middleNext = { ...slots, 2: 'p3', 3: 'p2' };
    expect(inferFormation(middleNext, {}, players)).toEqual(formation('5-1', 'middle', 1));
    // setter at 6: the next spot is 1 (wraps)
    const at6 = { 1: 'p3', 2: 'p2', 3: 'p6', 4: 'p5', 5: 'p4', 6: 'p1' };
    expect(inferFormation(at6, {}, players)).toEqual(formation('5-1', 'middle', 6));
    // an empty or unknown next spot: 'outside'
    expect(inferFormation({ ...slots, 2: null }, {}, players).order).toBe('outside');
    expect(inferFormation({ ...slots, 2: 'ghost' }, {}, players).order).toBe('outside');
    expect(inferFormation({ ...slots, 2: 'p9' }, {}, players).order).toBe('outside');
  });

  it('overrides win over the primary position', () => {
    // p2 (OH) plays MB after the setter → middle; p1 (S) overridden to OH → no setter at 1
    expect(inferFormation(slots, { p2: 'MB' }, players)).toEqual(formation('5-1', 'middle', 1));
    // p5 sets at 5; the next spot 6 holds the middle p6 → 'middle'
    expect(inferFormation(slots, { p1: 'OH', p5: 'S' }, players)).toEqual(
      formation('5-1', 'middle', 5),
    );
  });
});

describe('upgradeLineupToFormation', () => {
  const old = { setNumber: 1, slots: lineup().slots, liberoId: 'p7', roles: { p4: 'S' } };

  it('drops the roles and adds the matching formation', () => {
    expect(upgradeLineupToFormation(old, players)).toEqual({
      setNumber: 1,
      slots: old.slots,
      liberoId: 'p7',
      formation: formation('6-2', 'outside', 1),
    });
    const noRoles = { slots: { ...old.slots, 1: 'p2', 2: 'p1' } };
    expect(upgradeLineupToFormation(noRoles, players)).toEqual({
      ...noRoles,
      formation: formation('5-1', 'middle', 2), // p1 sets at 2, the middle p3 follows at 3
    });
  });

  it('ignores non-string roles and roles that are not a record', () => {
    expect(upgradeLineupToFormation({ ...old, roles: { p4: 5, p2: 'S' } }, players)).toMatchObject({
      formation: formation('5-1', 'outside', 1),
    });
    expect(upgradeLineupToFormation({ ...old, roles: ['S'] }, players)).toMatchObject({
      formation: formation('5-1', 'outside', 1),
    });
  });

  it('uses only well-formed players; players not an array = nobody known', () => {
    const messy = [null, 'p1', { id: 5, positions: ['S'] }, { id: 'p1' }, ...players.slice(1)];
    // p1 is not usable, so without overrides nobody sets: the default formation
    expect(upgradeLineupToFormation({ slots: old.slots }, messy)).toMatchObject({
      formation: DEFAULT_FORMATION,
    });
    expect(upgradeLineupToFormation({ slots: old.slots }, { p1: players[0] })).toMatchObject({
      formation: DEFAULT_FORMATION,
    });
    expect(upgradeLineupToFormation({ slots: old.slots, roles: { p2: 'S' } }, 'x')).toMatchObject({
      formation: formation('5-1', 'outside', 2),
    });
  });

  it('passes malformed input and lineups that already have a formation through', () => {
    for (const value of [null, 5, 'set', ['a'], { roles: {} }, { slots: null }, { slots: [] }]) {
      expect(upgradeLineupToFormation(value, players)).toBe(value);
    }
    const current = { slots: old.slots, roles: { p4: 'S' }, formation: DEFAULT_FORMATION };
    expect(upgradeLineupToFormation(current, players)).toBe(current);
  });
});

describe('roles in live play', () => {
  it('every rally knows the roles on court and the setter rotation', () => {
    // setter starts at 4 (the formation's setter spot follows); they serve first
    const set = lineup({
      weServeFirst: false,
      slots: { 1: 'p4', 2: 'p5', 3: 'p6', 4: 'p1', 5: 'p2', 6: 'p3' },
      formation: formation('5-1', 'outside', 4),
    });
    let played = addPoint(set, 'us'); // side-out: setter 4 → 3
    played = addPoint(played, 'them'); // they serve again; no rotation
    played = addPoint(played, 'us'); // side-out: setter 3 → 2
    const steps = replaySteps(played, players);
    const rallies = steps.flatMap((s) => (s.type === 'point' ? [s] : []));
    expect(rallies.map((r) => [r.rotation, r.setterRotation])).toEqual([
      [1, 4],
      [2, 3],
      [2, 3],
    ]);
    expect(rallies[0].roles).toEqual({
      p1: 'S',
      p2: 'OH',
      p3: 'MB',
      p4: 'OPP',
      p5: 'OH',
      p6: 'MB',
    });
    const state = replaySet(played, players);
    expect(state.rotation).toBe(3);
    expect(state.setterRotation).toBe(2);
  });

  it('a 6-2 names the rotation after the back-row setter', () => {
    const set = lineup({ formation: formation('6-2', 'outside', 1) });
    let played = addPoint(set, 'them'); // side-out for them; we receive, no rotation
    played = addPoint(played, 'us'); // side-out: p1 1 → 6, p4 4 → 3
    expect(replaySet(set, players).setterRotation).toBe(1);
    expect(replaySet(played, players).setterRotation).toBe(6);
  });

  it('a substitute takes over the role (and the setter rotation follows the new setter)', () => {
    const set = lineup();
    // setter p1 out for p8 (an OH): p8 now plays S at position 1
    let played = addSub(set, 'p1', 'p8');
    let state = replaySet(played, players);
    expect(state.roles.p8).toBe('S');
    expect(state.roles.p1).toBeUndefined();
    expect(state.setterRotation).toBe(1);
    // p1 back in for p5 takes the OH of p5's spot
    played = addSub(played, 'p5', 'p1');
    state = replaySet(played, players);
    expect(state.roles.p1).toBe('OH');
    // an invalid sub changes nothing
    const invalid = replaySet(addSub(set, 'p8', 'p2'), players);
    expect(invalid.roles).toEqual(replaySet(set, players).roles);
  });

  it('an unknown player on the setter spot has no role; no setter → null', () => {
    const set = lineup({ slots: { 1: 'ghost', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' } });
    const state = replaySet(set, players);
    expect(state.roles.ghost).toBeUndefined();
    expect(state.roles.p4).toBe('OPP');
    expect(state.setterRotation).toBeNull();
  });
});
