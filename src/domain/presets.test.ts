import { emptySetLineup } from './lineup';
import {
  applyPresetToSet,
  emptyPresetLineup,
  filledCount,
  firstSetForNewMatch,
  isPresetComplete,
  namedPresetsFor,
  nextPresetName,
  presetFromSet,
  presetToDraft,
  removePlayerFromPreset,
  startersFor,
  validatePresetName,
} from './presets';
import type { LineupPreset, Player, SetLineup } from './types';

const player = (id: string, number: number, active = true): Player => ({
  id,
  teamId: 't1',
  firstName: id,
  lastName: 'X',
  number,
  positions: ['OH'],
  active,
});

const players = ['a', 'b', 'c', 'd', 'e', 'f', 'l'].map((id, i) => player(id, i + 1));

const preset = (extra: Partial<LineupPreset> = {}): LineupPreset => ({
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  id: 'ps1',
  teamId: 't1',
  name: 'Five one',
  kind: 'preset',
  slots: { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' },
  liberoId: 'l',
  liberoReplaces: ['c', 'f'],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

describe('presetFromSet / presetToDraft', () => {
  it('copies only the lineup and back into a fresh draft', () => {
    const set: SetLineup = {
      ...emptySetLineup(3),
      slots: { 1: 'a', 2: null, 3: 'c', 4: null, 5: null, 6: null },
      liberoId: 'l',
      liberoReplaces: ['c'],
      weServeFirst: false,
      events: [{ type: 'point', winner: 'us' }],
    };
    const lineup = presetFromSet(set);
    expect(lineup).toEqual({
      slots: set.slots,
      liberoId: 'l',
      liberoReplaces: ['c'],
      formation: { system: '5-1', order: 'outside', setterAt: 1 },
      liberoActive: true,
    });
    expect(lineup.slots).not.toBe(set.slots);
    expect(presetToDraft(lineup)).toEqual({
      ...emptySetLineup(1),
      slots: set.slots,
      liberoId: 'l',
      liberoReplaces: ['c'],
    });
    expect(emptyPresetLineup()).toEqual(presetFromSet(emptySetLineup(1)));
  });
});

describe('applyPresetToSet', () => {
  it('copies slots, libero and libero replaces; keeps set number, serve and events', () => {
    const set: SetLineup = { ...emptySetLineup(2), weServeFirst: false };
    const result = applyPresetToSet(set, preset(), players);
    expect(result.skipped).toEqual([]);
    expect(result.set).toEqual({
      ...set,
      slots: preset().slots,
      liberoId: 'l',
      liberoReplaces: ['c', 'f'],
    });
  });

  it('skips injured players and players no longer in the team, leaving the spot empty', () => {
    const roster = players
      .filter((p) => p.id !== 'b')
      .map((p) => (p.id === 'l' ? player('l', 7, false) : p));
    const result = applyPresetToSet(
      emptySetLineup(1),
      preset({ liberoReplaces: ['c', 'b'] }),
      roster,
    );
    expect(result.skipped).toEqual(['b', 'l']);
    expect(result.set.slots[2]).toBeNull();
    expect(result.set.liberoId).toBeNull();
    expect(result.set.liberoReplaces).toEqual(['c']);
  });

  it('never places a player twice and drops duplicate libero replacements', () => {
    const p = preset({
      slots: { 1: 'a', 2: 'a', 3: null, 4: null, 5: null, 6: null },
      liberoId: 'a',
      liberoReplaces: ['a', 'a'],
    });
    const result = applyPresetToSet(emptySetLineup(1), p, players);
    expect(result.set.slots).toEqual({ 1: 'a', 2: null, 3: null, 4: null, 5: null, 6: null });
    expect(result.set.liberoId).toBeNull();
    expect(result.set.liberoReplaces).toEqual(['a']);
    expect(result.skipped).toEqual([]);
  });

  it('refuses a locked (played) set', () => {
    const played: SetLineup = { ...emptySetLineup(1), events: [{ type: 'point', winner: 'them' }] };
    const result = applyPresetToSet(played, preset(), players);
    expect(result.set).toBe(played);
    expect(result.skipped).toEqual([]);
  });
});

describe('queries', () => {
  const all = [
    preset({ id: 's', kind: 'starters', name: '' }),
    preset({ id: 'z', name: 'Zebra' }),
    preset({ id: 'b', name: 'Alpha' }),
    preset({ id: 'o', teamId: 't2', name: 'Other' }),
  ];

  it('finds the starters and the sorted named presets of a team', () => {
    expect(startersFor(all, 't1')?.id).toBe('s');
    expect(startersFor(all, 't2')).toBeUndefined();
    expect(namedPresetsFor(all, 't1').map((p) => p.id)).toEqual(['b', 'z']);
  });

  it('counts filled positions and knows when a preset is complete', () => {
    expect(isPresetComplete(preset())).toBe(true);
    const partial = preset({ slots: { ...preset().slots, 4: null } });
    expect(isPresetComplete(partial)).toBe(false);
    expect(filledCount(partial)).toBe(5);
  });

  it('suggests the next free name', () => {
    expect(nextPresetName('Lineup', all, 't1')).toBe('Lineup 1');
    const taken = [
      ...all,
      preset({ id: 'n1', name: 'lineup 1' }),
      preset({ id: 'n2', name: 'Lineup 2' }),
    ];
    expect(nextPresetName('Lineup', taken, 't1')).toBe('Lineup 3');
  });
});

describe('firstSetForNewMatch', () => {
  it('pre-fills set 1 from complete starters', () => {
    const starters = preset({ kind: 'starters' });
    const set = firstSetForNewMatch([starters], 't1', players);
    expect(set).toEqual({
      ...emptySetLineup(1),
      slots: starters.slots,
      liberoId: 'l',
      liberoReplaces: ['c', 'f'],
    });
  });

  it('starts empty without starters or with incomplete starters', () => {
    expect(firstSetForNewMatch([], 't1', players)).toEqual(emptySetLineup(1));
    const partial = preset({ kind: 'starters', slots: { ...preset().slots, 1: null } });
    expect(firstSetForNewMatch([partial], 't1', players)).toEqual(emptySetLineup(1));
  });
});

describe('removePlayerFromPreset', () => {
  it('clears the player from court, libero and libero replaces', () => {
    const p = preset();
    expect(removePlayerFromPreset(p, 'c')).toEqual({
      ...p,
      slots: { ...p.slots, 3: null },
      liberoReplaces: ['f'],
    });
    expect(removePlayerFromPreset(p, 'l').liberoId).toBeNull();
    expect(removePlayerFromPreset(preset({ liberoReplaces: ['x'] }), 'x').liberoReplaces).toEqual(
      [],
    );
  });

  it('drops the player’s role override (a role alone also counts as being in it)', () => {
    const p = preset({ roles: { c: 'OPP', f: 'DS' } });
    expect(removePlayerFromPreset(p, 'c').roles).toEqual({ f: 'DS' });
    // stale data: a role for someone no longer on court is removed too
    const stale = preset({ roles: { x: 'OH' } });
    expect(removePlayerFromPreset(stale, 'x').roles).toEqual({});
  });

  it('returns the same object when the player is not in it', () => {
    const p = preset();
    expect(removePlayerFromPreset(p, 'nobody')).toBe(p);
  });
});

describe('validatePresetName', () => {
  const all = [
    preset({ id: 'p1', name: 'Strong serve' }),
    preset({ id: 's', kind: 'starters', name: '' }),
  ];

  it('trims and accepts a new name', () => {
    expect(validatePresetName('  Rotation A ', all, 't1')).toEqual({
      ok: true,
      value: 'Rotation A',
    });
  });

  it('requires a name of at most 40 characters', () => {
    expect(validatePresetName('   ', all, 't1')).toEqual({ ok: false, error: 'required' });
    expect(validatePresetName('x'.repeat(41), all, 't1')).toEqual({ ok: false, error: 'tooLong' });
    expect(validatePresetName('x'.repeat(40), all, 't1').ok).toBe(true);
  });

  it('must be unique per team among named presets (ignoring case), except itself', () => {
    expect(validatePresetName('strong SERVE', all, 't1')).toEqual({ ok: false, error: 'taken' });
    expect(validatePresetName('Strong serve', all, 't1', 'p1').ok).toBe(true);
    expect(validatePresetName('Strong serve', all, 't2').ok).toBe(true);
  });
});
