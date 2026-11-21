import { emptySetLineup } from './lineup';
import { LIBERO_ROLE_GROUPS, liberoRoleState, toggleLiberoRole } from './liberoRoles';
import type { Player, Position, SetLineup } from './types';

const player = (id: string, positions: Position[]): Player => ({
  id,
  teamId: 't',
  firstName: id,
  lastName: '',
  number: 1,
  positions,
  active: true,
});

const players = [
  player('s1', ['S']),
  player('oh2', ['OH']),
  player('mb3', ['MB']),
  player('opp4', ['OPP']),
  player('oh5', ['OH']),
  player('mb6', ['MB']),
  player('l7', ['L']),
];

const set = (over: Partial<SetLineup> = {}): SetLineup => ({
  ...emptySetLineup(1),
  slots: { 1: 's1', 2: 'oh2', 3: 'mb3', 4: 'opp4', 5: 'oh5', 6: 'mb6' },
  liberoId: 'l7',
  ...over,
});

describe('libero replaces by role', () => {
  it('lists the role chips with the middles first', () => {
    expect(LIBERO_ROLE_GROUPS).toEqual(['MB', 'OH', 'OPP', 'S', 'DS']);
  });

  it('reports empty / on / off', () => {
    const s = set({ liberoReplaces: ['mb3', 'mb6', 'oh2'] });
    expect(liberoRoleState(s, players, 'DS')).toBe('empty');
    expect(liberoRoleState(s, players, 'MB')).toBe('on');
    expect(liberoRoleState(s, players, 'OH')).toBe('off');
  });

  it('adds the starters in that role, keeping the others', () => {
    const s = toggleLiberoRole(set({ liberoReplaces: ['mb3', 'oh2'] }), players, 'OH');
    expect(s.liberoReplaces).toEqual(['mb3', 'oh2', 'oh5']);
  });

  it('removes them when the role is on', () => {
    const s = toggleLiberoRole(set({ liberoReplaces: ['mb3', 'oh2', 'mb6'] }), players, 'MB');
    expect(s.liberoReplaces).toEqual(['oh2']);
  });

  it('follows role overrides, not the primary position', () => {
    const s = toggleLiberoRole(set({ roles: { opp4: 'OH' } }), players, 'OH');
    expect(s.liberoReplaces).toEqual(['oh2', 'opp4', 'oh5']);
  });

  it('changes nothing for a role nobody plays', () => {
    const s = set();
    expect(toggleLiberoRole(s, players, 'DS')).toBe(s);
  });
});
