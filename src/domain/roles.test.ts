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
  COURT_ROLES,
  isOffPosition,
  primaryPosition,
  roleOf,
  rotateStarters,
  setLiberoActive,
  setRole,
  setterRotation,
  startersWithRoles,
  startingRoles,
} from './roles';
import type { Player, Position, SetLineup } from './types';

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

describe('roles of players', () => {
  it('a starter plays the primary position unless overridden', () => {
    expect(COURT_ROLES).toEqual(['S', 'OH', 'MB', 'OPP', 'DS']);
    expect(primaryPosition(byId('p4'))).toBe('OPP');
    expect(primaryPosition(byId('p9'))).toBeNull();
    expect(roleOf({}, byId('p4'))).toBe('OPP');
    expect(roleOf({ p4: 'S' }, byId('p4'))).toBe('S');
    expect(roleOf({}, byId('p9'))).toBeNull();
  });

  it('off position = none of the player’s positions (secondary positions are fine)', () => {
    expect(isOffPosition(byId('p4'), 'OPP')).toBe(false);
    expect(isOffPosition(byId('p4'), 'OH')).toBe(false); // secondary
    expect(isOffPosition(byId('p4'), 'S')).toBe(true);
    expect(isOffPosition(byId('p9'), 'DS')).toBe(true);
    expect(isOffPosition(byId('p4'), null)).toBe(false);
  });
});

describe('setRole', () => {
  it('stores an override, and removes it when the primary position is chosen again', () => {
    const set = lineup();
    const asSetter = setRole(set, byId('p4'), 'S');
    expect(asSetter.roles).toEqual({ p4: 'S' });
    expect(setRole(asSetter, byId('p4'), 'OPP').roles).toEqual({});
    expect(setRole(asSetter, byId('p4'), 'S')).toBe(asSetter);
    expect(setRole(set, byId('p4'), 'OPP')).toBe(set);
    expect(setRole(asSetter, byId('p4'), 'OH').roles).toEqual({ p4: 'OH' });
  });

  it('ignores players not on court and locked (played) sets', () => {
    const set = lineup();
    expect(setRole(set, byId('p8'), 'S')).toBe(set);
    const played = addPoint(set, 'us');
    expect(setRole(played, byId('p4'), 'S')).toBe(played);
  });
});

describe('roles follow their players while editing', () => {
  const set = lineup({ roles: { p4: 'S', p2: 'DS' } });

  it('swapping and moving keep the role with the player', () => {
    expect(swapSlots(set, 2, 4).roles).toEqual({ p4: 'S', p2: 'DS' });
    expect(placePlayer(set, 'p4', 5).roles).toEqual({ p4: 'S', p2: 'DS' });
  });

  it('a player leaving the court loses the override', () => {
    expect(removeFromCourt(set, 4).roles).toEqual({ p2: 'DS' });
    expect(placePlayer(set, 'p8', 2).roles).toEqual({ p4: 'S' });
    expect(pruneLiberoReplaces(set)).toBe(set);
  });

  it('copies, presets and applying a preset carry roles and the libero switch', () => {
    const off = setLiberoActive(set, false);
    expect(copyLineup(off, 2)).toMatchObject({ roles: { p4: 'S', p2: 'DS' }, liberoActive: false });
    const preset = presetFromSet(off);
    expect(preset).toMatchObject({ roles: { p4: 'S', p2: 'DS' }, liberoActive: false });
    // p2 is injured: left out, and so is their role
    const roster = players.map((x) => (x.id === 'p2' ? { ...x, active: false } : x));
    const applied = applyPresetToSet(emptySetLineup(2), preset, roster);
    expect(applied.set.roles).toEqual({ p4: 'S' });
    expect(applied.set.liberoActive).toBe(false);
  });

  it('roles are locked in a played set (like the starting six)', () => {
    const played = addPoint(set, 'us');
    expect(applyLineupEdit(played, { ...played, roles: {} })).toBe(played);
    expect(applyLineupEdit(played, { ...played, roles: { p4: 'S', p2: 'OH' } })).toBe(played);
    const unchanged = { ...played, roles: { p4: 'S' as const, p2: 'DS' as const } };
    expect(applyLineupEdit(played, unchanged)).toBe(unchanged);
    // the libero switch stays editable
    const off = setLiberoActive(played, false);
    expect(applyLineupEdit(played, off)).toBe(off);
  });
});

describe('rotateStarters', () => {
  it('moves the starting six one position either way; roles follow', () => {
    const set = lineup({ roles: { p4: 'S' } });
    expect(rotateStarters(set, 'clockwise').slots).toEqual({
      1: 'p2',
      2: 'p3',
      3: 'p4',
      4: 'p5',
      5: 'p6',
      6: 'p1',
    });
    expect(rotateStarters(set, 'counterclockwise').slots).toEqual({
      1: 'p6',
      2: 'p1',
      3: 'p2',
      4: 'p3',
      5: 'p4',
      6: 'p5',
    });
    expect(rotateStarters(rotateStarters(set, 'clockwise'), 'counterclockwise').slots).toEqual(
      set.slots,
    );
    expect(rotateStarters(set, 'clockwise').roles).toEqual({ p4: 'S' });
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

  it('finds the starters playing given roles (overrides count)', () => {
    const set = lineup({ roles: { p5: 'DS' } });
    expect(startersWithRoles(set, players, ['MB'])).toEqual(['p3', 'p6']);
    expect(startersWithRoles(set, players, ['OH'])).toEqual(['p2']);
    expect(startersWithRoles(set, players, ['OH', 'DS'])).toEqual(['p2', 'p5']);
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

  it('starting roles skip unknown players and players without positions', () => {
    const set = lineup({ slots: { 1: 'p1', 2: 'p9', 3: 'ghost', 4: 'p4', 5: null, 6: 'p6' } });
    expect(startingRoles(set, players)).toEqual({ p1: 'S', p4: 'OPP', p6: 'MB' });
  });
});

describe('roles in live play', () => {
  it('every rally knows the roles on court and the setter rotation', () => {
    // setter starts at 4 (rotated so the setter isn't at 1); they serve first
    const set = lineup({
      weServeFirst: false,
      slots: { 1: 'p4', 2: 'p5', 3: 'p6', 4: 'p1', 5: 'p2', 6: 'p3' },
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

  it('a substitute takes over the role (and the setter rotation follows the new setter)', () => {
    const set = lineup({ roles: { p5: 'DS' } });
    // setter p1 out for p8 (an OH): p8 now plays S at position 1
    let played = addSub(set, 'p1', 'p8');
    let state = replaySet(played, players);
    expect(state.roles.p8).toBe('S');
    expect(state.roles.p1).toBeUndefined();
    expect(state.setterRotation).toBe(1);
    // the DS override is inherited too
    played = addSub(played, 'p5', 'p1');
    state = replaySet(played, players);
    expect(state.roles.p1).toBe('DS');
    // an invalid sub changes nothing
    const invalid = replaySet(addSub(set, 'p8', 'p2'), players);
    expect(invalid.roles).toEqual(replaySet(set, players).roles);
  });

  it('a substitute for a player without a role gets none; no setter → null', () => {
    const set = lineup({ slots: { 1: 'p9', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' } });
    const state = replaySet(addSub(set, 'p9', 'p8'), players);
    expect(state.roles.p8).toBeUndefined();
    expect(state.setterRotation).toBeNull();
  });
});
