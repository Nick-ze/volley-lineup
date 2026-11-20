import { parentRoute } from './parentRoute';

const lookup = (id: string) => (id === 'm1' ? 't1' : undefined);

describe('parentRoute', () => {
  it('maps each screen to its logical parent', () => {
    expect(parentRoute('teams', undefined, lookup)).toBe('/');
    expect(parentRoute('team/[teamId]/index', { teamId: 't1' }, lookup)).toBe('/teams');
    expect(parentRoute('settings', undefined, lookup)).toBe('/teams');
    expect(parentRoute('team/[teamId]/player', { teamId: 't1' }, lookup)).toEqual({
      pathname: '/team/[teamId]',
      params: { teamId: 't1' },
    });
    expect(parentRoute('team/[teamId]/match-new', { teamId: 't1' }, lookup)).toEqual({
      pathname: '/team/[teamId]',
      params: { teamId: 't1', tab: 'matches' },
    });
    expect(parentRoute('match/[matchId]/index', { matchId: 'm1' }, lookup)).toEqual({
      pathname: '/team/[teamId]',
      params: { teamId: 't1', tab: 'matches' },
    });
    expect(parentRoute('match/[matchId]/rotation', { matchId: 'm1' }, lookup)).toEqual({
      pathname: '/match/[matchId]',
      params: { matchId: 'm1' },
    });
    expect(parentRoute('match/[matchId]/starters', { matchId: 'm1' }, lookup)).toEqual({
      pathname: '/match/[matchId]',
      params: { matchId: 'm1' },
    });
  });

  it('keeps the set when going back from rotation to the match', () => {
    expect(parentRoute('match/[matchId]/rotation', { matchId: 'm1', set: '2' }, lookup)).toEqual({
      pathname: '/match/[matchId]',
      params: { matchId: 'm1', set: '2' },
    });
  });

  it('falls back to /teams when params or the match are missing', () => {
    expect(parentRoute('team/[teamId]/player', {}, lookup)).toBe('/teams');
    expect(parentRoute('team/[teamId]/match-new', { teamId: '' }, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/index', { matchId: 'nope' }, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/index', undefined, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/rotation', { matchId: 5 }, lookup)).toBe('/teams');
  });
});
