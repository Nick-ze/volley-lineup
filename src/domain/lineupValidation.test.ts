import { emptySetLineup } from './lineup';
import { positionsByPlayer, validateLineup } from './lineupValidation';
import type { Player, Position, SetLineup } from './types';

const mk = (id: string, positions: Position[], active = true): Player => ({
  id,
  teamId: 't1',
  firstName: id.toUpperCase(),
  lastName: 'X',
  number: Number(id.replace(/\D/g, '')) || 99,
  positions,
  active,
});

// A classic 5-1: S at 1, OPP at 4 (opposite), MBs at 3 & 6, OHs at 2 & 5.
const players: Player[] = [
  mk('s1', ['S']),
  mk('oh2', ['OH']),
  mk('mb3', ['MB']),
  mk('opp4', ['OPP']),
  mk('oh5', ['OH', 'DS']),
  mk('mb6', ['MB']),
  mk('l7', ['L']),
  mk('ds8', ['DS']),
  mk('x9', ['OH'], false),
];

const lineup = (slots: Partial<SetLineup['slots']>, liberoId: string | null = null): SetLineup => ({
  ...emptySetLineup(1),
  slots: { ...emptySetLineup(1).slots, ...slots },
  liberoId,
});

const good = lineup({ 1: 's1', 2: 'oh2', 3: 'mb3', 4: 'opp4', 5: 'oh5', 6: 'mb6' }, 'l7');

describe('validateLineup', () => {
  it('accepts a complete 5-1 lineup with a libero, no warnings', () => {
    expect(validateLineup(good, players)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('an empty set is INCOMPLETE (all positions) and gets no NO_SETTER warning', () => {
    const result = validateLineup(emptySetLineup(2), players);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([{ code: 'INCOMPLETE', positions: [1, 2, 3, 4, 5, 6] }]);
    expect(result.warnings).toEqual([]);
  });

  it('INCOMPLETE lists only the empty positions', () => {
    const result = validateLineup({ ...good, slots: { ...good.slots, 2: null, 5: null } }, players);
    expect(result.errors).toEqual([{ code: 'INCOMPLETE', positions: [2, 5] }]);
  });

  it('DUPLICATE_PLAYER: a player cannot be placed twice in the same set', () => {
    const result = validateLineup({ ...good, slots: { ...good.slots, 6: 'mb3' } }, players);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      { code: 'DUPLICATE_PLAYER', positions: [3, 6], playerId: 'mb3' },
    ]);
  });

  it('LIBERO_ON_COURT when the libero is also a starter', () => {
    const result = validateLineup({ ...good, slots: { ...good.slots, 5: 'l7' } }, players);
    expect(result.errors).toEqual([{ code: 'LIBERO_ON_COURT', positions: [5], playerId: 'l7' }]);
  });

  it('UNKNOWN_PLAYER for unknown slot and libero ids', () => {
    const result = validateLineup({ ...good, slots: { ...good.slots, 2: 'ghost' } }, players);
    expect(result.errors).toEqual([{ code: 'UNKNOWN_PLAYER', positions: [2], playerId: 'ghost' }]);

    const lib = validateLineup({ ...good, liberoId: 'nobody' }, players);
    expect(lib.errors).toEqual([{ code: 'UNKNOWN_PLAYER', playerId: 'nobody' }]);
    expect(lib.warnings).toEqual([]);
  });

  it('NO_SETTER when filled slots contain no player with S in any position', () => {
    const noSetter = lineup({ 1: 'ds8', 2: 'oh2' });
    expect(validateLineup(noSetter, players).warnings).toContainEqual({ code: 'NO_SETTER' });
    // A secondary 'S' counts as a setter.
    const secondary = [...players, mk('h10', ['OH', 'S'])];
    expect(
      validateLineup(lineup({ 1: 'h10' }), secondary).warnings.map((w) => w.code),
    ).not.toContain('NO_SETTER');
  });

  it('NO_SETTER ignores unknown ids (they are errors instead)', () => {
    const result = validateLineup(lineup({ 1: 'ghost' }), players);
    expect(result.warnings).toEqual([{ code: 'NO_SETTER' }]);
  });

  it('UNUSUAL_LAYOUT when the setter is not opposite the opposite', () => {
    const result = validateLineup(
      { ...good, slots: { ...good.slots, 4: 'oh2', 2: 'opp4' } },
      players,
    );
    expect(result.warnings).toEqual([{ code: 'UNUSUAL_LAYOUT', positions: [1, 2] }]);
  });

  it('UNUSUAL_LAYOUT when the two middles are not opposite each other', () => {
    const result = validateLineup(
      { ...good, slots: { ...good.slots, 6: 'oh5', 5: 'mb6' } },
      players,
    );
    expect(result.warnings).toEqual([{ code: 'UNUSUAL_LAYOUT', positions: [3, 5] }]);
  });

  it('no layout warning without exactly one S + one OPP / exactly two MBs', () => {
    const twoSetters = [...players, mk('s11', ['S'])];
    const result = validateLineup(lineup({ 1: 's1', 2: 's11', 3: 'opp4', 4: 'mb3' }), twoSetters);
    expect(result.warnings.map((w) => w.code)).not.toContain('UNUSUAL_LAYOUT');
  });

  it('INACTIVE_PLAYER for inactive starters and an inactive libero', () => {
    const benchLibero = [...players, mk('l12', ['L'], false)];
    const result = validateLineup({ ...good, slots: { ...good.slots, 5: 'x9' } }, benchLibero);
    expect(result.warnings).toEqual([{ code: 'INACTIVE_PLAYER', positions: [5], playerId: 'x9' }]);

    const lib = validateLineup({ ...good, liberoId: 'l12' }, benchLibero);
    expect(lib.warnings).toEqual([{ code: 'INACTIVE_PLAYER', playerId: 'l12' }]);
  });

  it('an inactive libero who is also on court is reported once', () => {
    const roster = [...players, mk('l12', ['L'], false)];
    const result = validateLineup(
      { ...good, slots: { ...good.slots, 5: 'l12' }, liberoId: 'l12' },
      roster,
    );
    expect(result.warnings.filter((w) => w.code === 'INACTIVE_PLAYER')).toEqual([
      { code: 'INACTIVE_PLAYER', positions: [5], playerId: 'l12' },
    ]);
  });

  it('LIBERO_NOT_LIBERO when the libero lacks the L position', () => {
    const result = validateLineup({ ...good, liberoId: 'ds8' }, players);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([{ code: 'LIBERO_NOT_LIBERO', playerId: 'ds8' }]);
  });

  it('valid is false whenever there is an error, warnings never block', () => {
    const warnOnly = validateLineup({ ...good, liberoId: 'ds8' }, players);
    expect(warnOnly.valid).toBe(true);
    const err = validateLineup({ ...good, slots: { ...good.slots, 1: null } }, players);
    expect(err.valid).toBe(false);
  });
});

describe('positionsByPlayer', () => {
  it('maps player ids to their slot positions', () => {
    const map = positionsByPlayer(lineup({ 1: 'a', 4: 'a', 2: 'b' }));
    expect([...map]).toEqual([
      ['a', [1, 4]],
      ['b', [2]],
    ]);
  });
});
