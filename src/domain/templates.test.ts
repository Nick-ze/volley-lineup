import { emptySetLineup } from './lineup';
import { validateLineup } from './lineupValidation';
import { isOffPosition, roleOf } from './roles';
import { acceptedFor, fillFromTemplate, TEMPLATE_SYSTEMS } from './templates';
import { COURT_POSITIONS, type Player, type Position, type SetLineup } from './types';

const player = (id: string, number: number, positions: Position[], active = true): Player => ({
  id,
  teamId: 't',
  firstName: id,
  lastName: id,
  number,
  positions,
  active,
});

/** A typical 12-player roster. */
const roster: Player[] = [
  player('s1', 1, ['S']),
  player('s2', 2, ['S', 'OPP']),
  player('oh1', 3, ['OH']),
  player('oh2', 4, ['OH']),
  player('oh3', 5, ['OH', 'DS']),
  player('mb1', 6, ['MB']),
  player('mb2', 7, ['MB']),
  player('mb3', 8, ['MB', 'OPP']),
  player('opp1', 9, ['OPP']),
  player('opp2', 10, ['OPP', 'OH']),
  player('l1', 11, ['L']),
  player('ds1', 12, ['DS', 'L']),
];

const ids = (set: SetLineup) => COURT_POSITIONS.map((p) => set.slots[p]);

describe('fillFromTemplate — 5-1', () => {
  it('fills S 1, OH 2, MB 3, OPP 4, OH 5, MB 6 by primary position', () => {
    const { set, missing, missingSlots } = fillFromTemplate('5-1', roster, 2);
    expect(set.slots).toEqual({ 1: 's1', 2: 'oh1', 3: 'mb1', 4: 'opp1', 5: 'oh2', 6: 'mb2' });
    expect(set.setNumber).toBe(2);
    expect(missing).toEqual([]);
    expect(missingSlots).toEqual([]);
    expect(set.liberoReplaces).toEqual(['mb1', 'mb2']);
    expect(set.liberoId).toBeNull();
  });

  it('produces a lineup without errors or layout warnings', () => {
    const { set } = fillFromTemplate('5-1', roster, 1);
    const result = validateLineup(set, roster);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('fillFromTemplate — 6-2', () => {
  it('puts the two setters opposite each other (1 and 4), outsides and middles opposite', () => {
    const { set, missing } = fillFromTemplate('6-2', roster, 1);
    expect(set.slots).toEqual({ 1: 's1', 2: 'oh1', 3: 'mb1', 4: 's2', 5: 'oh2', 6: 'mb2' });
    expect(missing).toEqual([]);
    expect(validateLineup(set, roster).errors).toEqual([]);
  });

  it('uses an opposite in a hitter spot when outsides run out', () => {
    const team = roster.filter((p) => !['oh2', 'oh3'].includes(p.id));
    const { set } = fillFromTemplate('6-2', team, 1);
    expect(set.slots[2]).toBe('oh1');
    // Primary OPP before a secondary OH.
    expect(set.slots[5]).toBe('opp1');
  });
});

describe('fillFromTemplate — fallbacks and missing positions', () => {
  it('falls back to secondary positions, after all primary matches', () => {
    const team = roster.filter((p) => !['opp1', 'opp2'].includes(p.id));
    const { set, missing } = fillFromTemplate('5-1', team, 1);
    // s2 (S, OPP) is not needed as setter, so takes OPP by secondary position before mb3 (#8).
    expect(set.slots[4]).toBe('s2');
    expect(missing).toEqual([]);
  });

  it('leaves slots empty and reports them when positions are missing', () => {
    const team = [player('s', 1, ['S']), player('oh', 2, ['OH']), player('mb', 3, ['MB'])];
    const { set, missing, missingSlots } = fillFromTemplate('5-1', team, 1);
    expect(set.slots).toEqual({ 1: 's', 2: 'oh', 3: 'mb', 4: null, 5: null, 6: null });
    expect(missing).toEqual(['OPP', 'OH', 'MB']);
    expect(missingSlots).toEqual([
      { position: 4, role: 'OPP' },
      { position: 5, role: 'OH' },
      { position: 6, role: 'MB' },
    ]);
  });

  it('fills nothing from an empty roster', () => {
    const { set, missing } = fillFromTemplate('6-2', [], 1);
    expect(ids(set).every((id) => id === null)).toBe(true);
    expect(missing).toEqual(['S', 'OH', 'MB', 'S', 'OH', 'MB']);
  });
});

describe('fillFromTemplate — rules', () => {
  it('uses only active players', () => {
    const team = roster.map((p) => (p.id === 's1' ? { ...p, active: false } : p));
    const { set } = fillFromTemplate('5-1', team, 1);
    expect(ids(set)).not.toContain('s1');
    expect(set.slots[1]).toBe('s2');
  });

  it('never places the same player twice', () => {
    const onlyOne = [player('x', 1, ['S', 'OH', 'MB', 'OPP'])];
    for (const system of TEMPLATE_SYSTEMS) {
      const { set } = fillFromTemplate(system, onlyOne, 1);
      expect(ids(set).filter((id) => id === 'x')).toHaveLength(1);
    }
  });

  it('never puts the libero or a primary libero on court, and keeps the current libero', () => {
    const current: SetLineup = {
      ...emptySetLineup(3),
      slots: { 1: 'ds1', 2: null, 3: null, 4: null, 5: null, 6: null },
      liberoId: 'mb1',
      weServeFirst: false,
      events: [{ type: 'point', winner: 'us' }],
    };
    const team = [...roster, player('l2', 13, ['L', 'OH'])];
    const { set } = fillFromTemplate('5-1', team, 3, current);
    expect(ids(set)).not.toContain('mb1');
    expect(ids(set)).not.toContain('l1');
    expect(ids(set)).not.toContain('l2');
    expect(set.liberoId).toBe('mb1');
    expect(set.weServeFirst).toBe(false);
    expect(set.events).toEqual(current.events);
    expect(set.slots[3]).toBe('mb2');
    // mb3 is a primary MB and takes the second middle spot.
    expect(set.slots[6]).toBe('mb3');
    expect(set.liberoReplaces).toEqual(['mb2', 'mb3']);
  });

  it('accepts an opposite after the outsides only on a 6-2 hitter spot', () => {
    expect(TEMPLATE_SYSTEMS).toEqual(['5-1', '6-2']);
    expect(acceptedFor('6-2', 'OH')).toEqual(['OH', 'OPP']);
    expect(acceptedFor('5-1', 'OH')).toEqual(['OH']);
    expect(acceptedFor('6-2', 'S')).toEqual(['S']);
    expect(acceptedFor('5-1', 'OPP')).toEqual(['OPP']);
  });
});

describe('fillFromTemplate — formation (v6)', () => {
  it('sets the formation’s system; everyone plays the role of their spot', () => {
    const fiveOne = fillFromTemplate('5-1', roster, 1).set;
    expect(fiveOne.formation).toEqual({ system: '5-1', order: 'outside', setterAt: 1 });
    expect(COURT_POSITIONS.map((p) => roleOf(fiveOne, fiveOne.slots[p] as string))).toEqual([
      'S',
      'OH',
      'MB',
      'OPP',
      'OH',
      'MB',
    ]);
    expect(fillFromTemplate('6-2', roster, 1).set.formation).toEqual({
      system: '6-2',
      order: 'outside',
      setterAt: 1,
    });
  });

  it('an opposite on a 6-2 hitter spot plays OH (off position, no dialog)', () => {
    const team = roster.filter((p) => !['oh2', 'oh3'].includes(p.id));
    const { set } = fillFromTemplate('6-2', team, 1);
    expect(set.slots[5]).toBe('opp1');
    expect(roleOf(set, 'opp1')).toBe('OH');
    expect(isOffPosition(team.find((p) => p.id === 'opp1') as Player, 'OH')).toBe(true);
  });

  it('a player filling a spot by a secondary position plays the spot’s role', () => {
    const team = roster.filter((p) => !['mb1', 'mb2'].includes(p.id));
    const { set } = fillFromTemplate('5-1', [...team, player('x', 20, ['OH', 'MB'])], 1);
    // mb3 (primary MB) takes 3; the second middle spot goes to a secondary MB.
    expect(set.slots[3]).toBe('mb3');
    expect(set.slots[6]).toBe('x');
    expect(roleOf(set, 'x')).toBe('MB');
    expect(set.liberoReplaces).toEqual(['mb3', 'x']);
  });

  it('fills a formation with the setter spot at 4 (5-1, outside)', () => {
    // Spots from the setter: S 4 · OH 5 · MB 6 · OPP 1 · OH 2 · MB 3 (worked out by hand).
    const current = {
      ...emptySetLineup(1),
      formation: { ...emptySetLineup(1).formation, setterAt: 4 as const },
    };
    const { set, missing } = fillFromTemplate('5-1', roster, 1, current);
    expect(set.slots).toEqual({ 1: 'opp1', 2: 'oh1', 3: 'mb1', 4: 's1', 5: 'oh2', 6: 'mb2' });
    expect(set.formation).toEqual({ system: '5-1', order: 'outside', setterAt: 4 });
    expect(missing).toEqual([]);
    expect(set.liberoReplaces).toEqual(['mb1', 'mb2']);
    expect(validateLineup(set, roster).warnings).toEqual([]);
  });

  it('fills the middle order: S 1 · MB 2 · OH 3 · OPP 4 · MB 5 · OH 6', () => {
    const current = {
      ...emptySetLineup(1),
      formation: { system: '5-1' as const, order: 'middle' as const, setterAt: 1 as const },
    };
    const { set } = fillFromTemplate('5-1', roster, 1, current);
    expect(set.slots).toEqual({ 1: 's1', 2: 'mb1', 3: 'oh1', 4: 'opp1', 5: 'mb2', 6: 'oh2' });
    expect(set.liberoReplaces).toEqual(['mb1', 'mb2']);
  });

  it('keeps the current order and setter spot (6-2, middle, setter at 3) and the libero switch', () => {
    // Spots: S 3 · MB 4 · OH 5 · S 6 · MB 1 · OH 2 (worked out by hand).
    const current: SetLineup = {
      ...emptySetLineup(1),
      slots: { 1: 'oh1', 2: null, 3: null, 4: null, 5: null, 6: null },
      formation: { system: '5-1', order: 'middle', setterAt: 3 },
      liberoActive: false,
    };
    const { set, missing } = fillFromTemplate('6-2', roster, 1, current);
    expect(set.formation).toEqual({ system: '6-2', order: 'middle', setterAt: 3 });
    expect(set.slots).toEqual({ 1: 'mb1', 2: 'oh1', 3: 's1', 4: 'mb2', 5: 'oh2', 6: 's2' });
    expect(missing).toEqual([]);
    expect(set.liberoReplaces).toEqual(['mb1', 'mb2']);
    expect(set.liberoActive).toBe(false);
  });

  it('reports missing spots by the formation’s roles', () => {
    // 5-1 middle, setter at 3: S 3 · MB 4 · OH 5 · OPP 6 · MB 1 · OH 2.
    const team = [player('s', 1, ['S']), player('oh', 2, ['OH']), player('mb', 3, ['MB'])];
    const current = {
      ...emptySetLineup(1),
      formation: { system: '5-1' as const, order: 'middle' as const, setterAt: 3 as const },
    };
    const { set, missingSlots } = fillFromTemplate('5-1', team, 1, current);
    expect(set.slots).toEqual({ 1: 'mb', 2: 'oh', 3: 's', 4: null, 5: null, 6: null });
    expect(missingSlots).toEqual([
      { position: 4, role: 'MB' },
      { position: 5, role: 'OH' },
      { position: 6, role: 'OPP' },
    ]);
  });
});
