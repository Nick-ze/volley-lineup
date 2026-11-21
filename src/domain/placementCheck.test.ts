import { emptySetLineup } from './lineup';
import { swapSlots, placePlayer } from './lineupEditing';
import { newOffPositionPlacements } from './placementCheck';
import { rotateStarters, setFormation } from './roles';
import type { Player, SetLineup } from './types';

const player = (id: string, positions: Player['positions']) => ({ id, positions });
const players = [
  player('s', ['S']),
  player('oh1', ['OH']),
  player('mb1', ['MB']),
  player('opp', ['OPP']),
  player('oh2', ['OH', 'OPP']),
  player('mb2', ['MB']),
  player('lib', ['L']),
];
// Default formation 5-1 / outside / setter at 1: 1 S · 2 OH · 3 MB · 4 OPP · 5 OH · 6 MB.
const full = (): SetLineup => ({
  ...emptySetLineup(1),
  slots: { 1: 's', 2: 'oh1', 3: 'mb1', 4: 'opp', 5: 'oh2', 6: 'mb2' },
});

describe('newOffPositionPlacements', () => {
  it('is empty for a player placed on a spot of their primary position', () => {
    const before = emptySetLineup(1);
    expect(newOffPositionPlacements(before, placePlayer(before, 'mb1', 3), players)).toEqual([]);
  });

  it('is empty for a listed secondary position', () => {
    const before = emptySetLineup(1);
    expect(newOffPositionPlacements(before, placePlayer(before, 'oh2', 4), players)).toEqual([]);
  });

  it('names a player placed on a role that is none of their positions', () => {
    const before = emptySetLineup(1);
    expect(newOffPositionPlacements(before, placePlayer(before, 'oh1', 3), players)).toEqual([
      { playerId: 'oh1', position: 3, role: 'MB' },
    ]);
  });

  it('names both players of a swap when both end up off position', () => {
    const before = full();
    expect(newOffPositionPlacements(before, swapSlots(before, 1, 3), players)).toEqual([
      { playerId: 'mb1', position: 1, role: 'S' },
      { playerId: 's', position: 3, role: 'MB' },
    ]);
  });

  it('only names the player whose new role is off position in a swap', () => {
    const before = full();
    // oh2 (OH, OPP) to the OPP spot is fine; opp to an OH spot is not.
    expect(newOffPositionPlacements(before, swapSlots(before, 4, 5), players)).toEqual([
      { playerId: 'opp', position: 5, role: 'OH' },
    ]);
  });

  it('ignores moves that keep the role (same-role spots, rotations)', () => {
    const before = full();
    expect(newOffPositionPlacements(before, swapSlots(before, 2, 5), players)).toEqual([]);
    expect(newOffPositionPlacements(before, rotateStarters(before, 'clockwise'), players)).toEqual(
      [],
    );
  });

  it('does not ask again about players already off position who did not move', () => {
    const before = { ...full(), slots: { ...full().slots, 3: 'oh1', 2: 'mb1' } };
    expect(newOffPositionPlacements(before, swapSlots(before, 1, 4), players)).toEqual([
      { playerId: 'opp', position: 1, role: 'S' },
      { playerId: 's', position: 4, role: 'OPP' },
    ]);
  });

  it('names starters a formation change puts on unlisted roles', () => {
    const before = full();
    expect(
      newOffPositionPlacements(before, setFormation(before, { system: '6-2' }), players),
    ).toEqual([{ playerId: 'opp', position: 4, role: 'S' }]);
  });

  it('names a libero moved onto court and ignores unknown ids', () => {
    const before = { ...emptySetLineup(1), liberoId: 'lib' };
    const after = {
      ...placePlayer(before, 'lib', 6),
      slots: { ...placePlayer(before, 'lib', 6).slots, 2: 'ghost' },
    };
    expect(newOffPositionPlacements(before, after, players)).toEqual([
      { playerId: 'lib', position: 6, role: 'MB' },
    ]);
  });
});
