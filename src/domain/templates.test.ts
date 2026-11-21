import { emptySetLineup } from './lineup';
import { validateLineup } from './lineupValidation';
import { fillFromTemplate, TEMPLATE_LAYOUTS, TEMPLATE_SYSTEMS } from './templates';
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

  it('describes every system with all six positions', () => {
    for (const system of TEMPLATE_SYSTEMS) {
      expect(Object.keys(TEMPLATE_LAYOUTS[system])).toHaveLength(6);
    }
  });
});
