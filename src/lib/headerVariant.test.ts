import { headerVariant } from './headerVariant';

describe('headerVariant', () => {
  it('browse screens are large, match stats and performance bare, the rest compact', () => {
    expect(headerVariant('team/[teamId]/index')).toBe('large');
    expect(headerVariant('match/[matchId]/stats')).toBe('bare');
    expect(headerVariant('match/[matchId]/index')).toBe('compact');
    expect(headerVariant('something-new')).toBe('compact');
  });

  it('v12: a hosted tournament and its team are large; the form and the result compact', () => {
    expect(headerVariant('tournament/[tournamentId]/index')).toBe('large');
    expect(headerVariant('tournament/[tournamentId]/team/[teamId]')).toBe('large');
    expect(headerVariant('tournament-new')).toBe('compact');
    expect(headerVariant('tournament/[tournamentId]/match')).toBe('compact');
  });
});
