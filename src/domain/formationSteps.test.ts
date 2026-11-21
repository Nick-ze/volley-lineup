import { formationAtStep, formationLabels, rotateFormation, stepSpotRoles } from './formationSteps';
import { ROTATION_NUMBERS } from './rotation';
import { COURT_POSITIONS, type Formation, type Position } from './types';

const f = (over: Partial<Formation> = {}): Formation => ({
  system: '5-1',
  order: 'outside',
  setterAt: 1,
  ...over,
});
/** Roles of positions 1–6 in one step. */
const row = (formation: Formation, step: (typeof ROTATION_NUMBERS)[number]): Position[] => {
  const roles = stepSpotRoles(formation, step);
  return COURT_POSITIONS.map((p) => roles[p]);
};

describe('rotateFormation', () => {
  it('moves the setter spot clockwise (2→1, 1→6) and back, wrapping every 6 steps', () => {
    expect(rotateFormation(f({ setterAt: 2 }), 1).setterAt).toBe(1);
    expect(rotateFormation(f({ setterAt: 1 }), 1).setterAt).toBe(6);
    expect(rotateFormation(f({ setterAt: 6 }), -1).setterAt).toBe(1);
    expect(rotateFormation(f({ setterAt: 4 }), 6).setterAt).toBe(4);
    expect(rotateFormation(f({ setterAt: 4 }), -7).setterAt).toBe(5);
    expect(rotateFormation(f({ system: '6-2', order: 'middle' }), 2)).toEqual({
      system: '6-2',
      order: 'middle',
      setterAt: 5,
    });
  });

  it('formationAtStep: step 1 is the start', () => {
    expect(formationAtStep(f({ setterAt: 3 }), 1).setterAt).toBe(3);
    expect(formationAtStep(f({ setterAt: 3 }), 4).setterAt).toBe(6);
  });
});

describe('stepSpotRoles — all six steps, literal layouts (VOLLEYBALL_RULES §2.1–2.2)', () => {
  it('5-1, setter followed by an outside (variant A)', () => {
    const steps = ROTATION_NUMBERS.map((s) => row(f(), s));
    expect(steps).toEqual([
      ['S', 'OH', 'MB', 'OPP', 'OH', 'MB'],
      ['OH', 'MB', 'OPP', 'OH', 'MB', 'S'],
      ['MB', 'OPP', 'OH', 'MB', 'S', 'OH'],
      ['OPP', 'OH', 'MB', 'S', 'OH', 'MB'],
      ['OH', 'MB', 'S', 'OH', 'MB', 'OPP'],
      ['MB', 'S', 'OH', 'MB', 'OPP', 'OH'],
    ]);
  });

  it('5-1, setter followed by a middle (variant B)', () => {
    const steps = ROTATION_NUMBERS.map((s) => row(f({ order: 'middle' }), s));
    expect(steps).toEqual([
      ['S', 'MB', 'OH', 'OPP', 'MB', 'OH'],
      ['MB', 'OH', 'OPP', 'MB', 'OH', 'S'],
      ['OH', 'OPP', 'MB', 'OH', 'S', 'MB'],
      ['OPP', 'MB', 'OH', 'S', 'MB', 'OH'],
      ['MB', 'OH', 'S', 'MB', 'OH', 'OPP'],
      ['OH', 'S', 'MB', 'OH', 'OPP', 'MB'],
    ]);
  });

  it('6-2 starting with the setter spot at 4', () => {
    const steps = ROTATION_NUMBERS.map((s) => row(f({ system: '6-2', setterAt: 4 }), s));
    expect(steps).toEqual([
      ['S', 'OH', 'MB', 'S', 'OH', 'MB'],
      ['OH', 'MB', 'S', 'OH', 'MB', 'S'],
      ['MB', 'S', 'OH', 'MB', 'S', 'OH'],
      ['S', 'OH', 'MB', 'S', 'OH', 'MB'],
      ['OH', 'MB', 'S', 'OH', 'MB', 'S'],
      ['MB', 'S', 'OH', 'MB', 'S', 'OH'],
    ]);
  });

  it('the pairs 1–4, 2–5, 3–6 always share a kind of role', () => {
    for (const system of ['5-1', '6-2'] as const)
      for (const order of ['outside', 'middle'] as const)
        for (const step of ROTATION_NUMBERS) {
          const r = row(f({ system, order }), step);
          const kind = (p: Position) => (p === 'OPP' ? 'S' : p);
          expect([kind(r[0]!), kind(r[1]!), kind(r[2]!)]).toEqual([
            kind(r[3]!),
            kind(r[4]!),
            kind(r[5]!),
          ]);
        }
  });
});

describe('formationLabels', () => {
  it('names each step after the setter spot (setter at 4: 4, 3, 2, 1, 6, 5)', () => {
    expect(formationLabels(f({ setterAt: 4 }))).toEqual([4, 3, 2, 1, 6, 5]);
    expect(formationLabels(f())).toEqual([1, 6, 5, 4, 3, 2]);
  });

  it('6-2: the back-row setter spot, so each number comes up twice', () => {
    expect(formationLabels(f({ system: '6-2' }))).toEqual([1, 6, 5, 1, 6, 5]);
    expect(formationLabels(f({ system: '6-2', setterAt: 3 }))).toEqual([6, 5, 1, 6, 5, 1]);
  });
});
