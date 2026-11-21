import { parentRoute } from './parentRoute';

const lookup = (id: string) => (id === 'm1' ? 't1' : undefined);

describe('parentRoute', () => {
  it('maps each screen to its logical parent', () => {
    expect(parentRoute('team/[teamId]/index', { teamId: 't1' }, lookup)).toBe('/teams');
    expect(parentRoute('+not-found', undefined, lookup)).toBe('/teams');
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

  it('goes back from live mode to the match, keeping the set', () => {
    expect(parentRoute('match/[matchId]/live', { matchId: 'm1', set: '3' }, lookup)).toEqual({
      pathname: '/match/[matchId]',
      params: { matchId: 'm1', set: '3' },
    });
    expect(parentRoute('match/[matchId]/live', {}, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/stats', { matchId: 'm1' }, lookup)).toEqual({
      pathname: '/match/[matchId]',
      params: { matchId: 'm1' },
    });
  });

  it('v6: player detail goes back to the roster, performance to the match', () => {
    expect(parentRoute('team/[teamId]/players/[playerId]', { teamId: 't1' }, lookup)).toEqual({
      pathname: '/team/[teamId]',
      params: { teamId: 't1' },
    });
    expect(parentRoute('team/[teamId]/players/[playerId]', {}, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/performance', { matchId: 'm1', set: '2' }, lookup)).toEqual(
      { pathname: '/match/[matchId]', params: { matchId: 'm1', set: '2' } },
    );
  });

  it('goes back from a preset or the team starters to that tab of the team', () => {
    const preset = { teamId: 't1', presetId: 'ps1' };
    expect(parentRoute('team/[teamId]/preset/[presetId]', preset, lookup)).toEqual({
      pathname: '/team/[teamId]',
      params: { teamId: 't1', tab: 'presets' },
    });
    expect(parentRoute('team/[teamId]/starters', { teamId: 't1' }, lookup)).toEqual({
      pathname: '/team/[teamId]',
      params: { teamId: 't1', tab: 'starters' },
    });
    expect(parentRoute('team/[teamId]/preset/[presetId]', {}, lookup)).toBe('/teams');
    expect(parentRoute('team/[teamId]/starters', undefined, lookup)).toBe('/teams');
  });

  it('falls back to /teams when params or the match are missing', () => {
    expect(parentRoute('team/[teamId]/player', {}, lookup)).toBe('/teams');
    expect(parentRoute('team/[teamId]/match-new', { teamId: '' }, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/index', { matchId: 'nope' }, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/index', undefined, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/rotation', { matchId: 5 }, lookup)).toBe('/teams');
  });
});
