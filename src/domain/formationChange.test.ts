import { changeFormation } from './formationChange';
import { emptySetLineup } from './lineup';
import type { Player, Position, SetLineup } from './types';

const player = (id: string, position: Position): Player => ({
  id,
  teamId: 't',
  firstName: id,
  lastName: '',
  number: Number(id.slice(1)),
  positions: [position],
  active: true,
});
const players = [
  player('p1', 'S'),
  player('p2', 'OH'),
  player('p3', 'MB'),
  player('p4', 'OPP'),
  player('p5', 'OH'),
  player('p6', 'MB'),
];
// 5-1 / outside / setter at 1: MB spots 3 and 6; 'middle' order: MB spots 2 and 5.
const full = (liberoReplaces: string[]): SetLineup => ({
  ...emptySetLineup(1),
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  liberoReplaces,
});

describe('changeFormation', () => {
  it('moves the libero to the new middles when it replaced exactly the old ones', () => {
    const next = changeFormation(full(['p6', 'p3']), { order: 'middle' }, players);
    expect(next.formation.order).toBe('middle');
    expect(next.liberoReplaces).toEqual(['p2', 'p5']);
  });

  it('leaves any other libero choice alone', () => {
    expect(changeFormation(full(['p3']), { order: 'middle' }, players).liberoReplaces).toEqual([
      'p3',
    ]);
    expect(
      changeFormation(full(['p3', 'p6', 'p2']), { order: 'middle' }, players).liberoReplaces,
    ).toEqual(['p3', 'p6', 'p2']);
    expect(
      changeFormation(full(['p3', 'p2']), { order: 'middle' }, players).liberoReplaces,
    ).toEqual(['p3', 'p2']);
  });

  it('keeps "nobody" when no middle is on court', () => {
    const next = changeFormation(
      { ...emptySetLineup(1), liberoReplaces: [] },
      { system: '6-2' },
      players,
    );
    expect(next.formation.system).toBe('6-2');
    expect(next.liberoReplaces).toEqual([]);
  });

  it('returns the same set when nothing changes or the set is locked', () => {
    const set = full(['p3', 'p6']);
    expect(changeFormation(set, { system: '5-1' }, players)).toBe(set);
    const locked = { ...set, events: [{ type: 'point' as const, winner: 'us' as const }] };
    expect(changeFormation(locked, { system: '6-2' }, players)).toBe(locked);
  });
});
