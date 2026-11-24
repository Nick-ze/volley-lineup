import { chooseCaptain, isCaptain, setCaptain, withValidCaptain } from './captain';
import type { Team } from './types';

const team: Team = { id: 't1', profileId: 'pr1', name: 'Herren', createdAt: '2026-01-01' };
const withCaptain: Team = { ...team, captainId: 'p1' };

describe('isCaptain', () => {
  it('is true only for the team’s captain', () => {
    expect(isCaptain(withCaptain, 'p1')).toBe(true);
    expect(isCaptain(withCaptain, 'p2')).toBe(false);
    expect(isCaptain(team, 'p1')).toBe(false);
    expect(isCaptain(undefined, 'p1')).toBe(false);
  });
});

describe('setCaptain', () => {
  it('makes the player the captain, replacing the previous one', () => {
    expect(setCaptain(team, 'p1')).toEqual(withCaptain);
    expect(setCaptain(withCaptain, 'p2')).toEqual({ ...team, captainId: 'p2' });
    expect(team).not.toHaveProperty('captainId'); // not mutated
  });

  it('returns the same team when nothing changes', () => {
    expect(setCaptain(withCaptain, 'p1')).toBe(withCaptain);
    expect(setCaptain(team, null)).toBe(team);
  });

  it('null removes the captain (no captainId key left)', () => {
    const cleared = setCaptain(withCaptain, null);
    expect(cleared).toEqual(team);
    expect(cleared).not.toHaveProperty('captainId');
  });
});

describe('chooseCaptain (the form switch)', () => {
  it('on: the player becomes the captain', () => {
    expect(chooseCaptain(team, 'p2', true)).toEqual({ ...team, captainId: 'p2' });
    expect(chooseCaptain(withCaptain, 'p2', true)).toEqual({ ...team, captainId: 'p2' });
  });

  it('off: clears the captain only when it was this player', () => {
    expect(chooseCaptain(withCaptain, 'p1', false)).toEqual(team);
    expect(chooseCaptain(withCaptain, 'p2', false)).toBe(withCaptain);
    expect(chooseCaptain(team, 'p2', false)).toBe(team);
  });
});

describe('withValidCaptain', () => {
  const players = [
    { id: 'p1', teamId: 't1' },
    { id: 'p9', teamId: 't2' },
  ];

  it('keeps a captain who is a player of the team, and a team without one', () => {
    expect(withValidCaptain(withCaptain, players)).toBe(withCaptain);
    expect(withValidCaptain(team, players)).toBe(team);
  });

  it('drops a captain of another team or an unknown player', () => {
    expect(withValidCaptain({ ...team, captainId: 'p9' }, players)).toEqual(team);
    expect(withValidCaptain({ ...team, captainId: 'nobody' }, players)).toEqual(team);
  });
});
