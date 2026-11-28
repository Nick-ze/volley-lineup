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

  it("v7: a season and a new season go back to the team's seasons (matches tab)", () => {
    expect(
      parentRoute('team/[teamId]/season/[seasonId]', { teamId: 't1', seasonId: 's1' }, lookup),
    ).toEqual({ pathname: '/team/[teamId]', params: { teamId: 't1', tab: 'matches' } });
    for (const route of ['team/[teamId]/season-new', 'team/[teamId]/match-new']) {
      expect(parentRoute(route, { teamId: 't1' }, lookup)).toEqual({
        pathname: '/team/[teamId]',
        params: { teamId: 't1', tab: 'matches' },
      });
    }
  });

  it('v7: editing a season, a new match in a season and a match go back to the season', () => {
    const season = {
      pathname: '/team/[teamId]/season/[seasonId]',
      params: { teamId: 't1', seasonId: 's1' },
    };
    for (const route of ['team/[teamId]/season-new', 'team/[teamId]/match-new']) {
      expect(parentRoute(route, { teamId: 't1', seasonId: 's1' }, lookup)).toEqual(season);
    }
    const seasonOf = (id: string) => (id === 'm1' ? 's1' : undefined);
    expect(parentRoute('match/[matchId]/index', { matchId: 'm1' }, lookup, seasonOf)).toEqual(
      season,
    );
    // A match whose season can't be found still goes back to its team.
    expect(
      parentRoute('match/[matchId]/index', { matchId: 'm1' }, lookup, () => undefined),
    ).toEqual({ pathname: '/team/[teamId]', params: { teamId: 't1', tab: 'matches' } });
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

  it('v10: account screens go back to the profile / account, members to the team', () => {
    expect(parentRoute('account/index', {}, lookup)).toBe('/profile');
    expect(parentRoute('account/sign-in', {}, lookup)).toBe('/profile');
    expect(parentRoute('account/teams', {}, lookup)).toBe('/account');
    expect(parentRoute('team/[teamId]/members', { teamId: 't1' }, lookup)).toEqual({
      pathname: '/team/[teamId]',
      params: { teamId: 't1' },
    });
    expect(parentRoute('team/[teamId]/members', {}, lookup)).toBe('/teams');
    expect(parentRoute('join', {}, lookup)).toBe('/teams');
  });

  it('v12: hosted tournament screens go back to the tournament or the Tournaments tab', () => {
    const tournamentId = 'h1';
    expect(parentRoute('tournament/[tournamentId]/index', { tournamentId }, lookup)).toBe(
      '/tournaments',
    );
    expect(parentRoute('tournament-new', {}, lookup)).toBe('/tournaments');
    expect(parentRoute('tournament-new', { tournamentId }, lookup)).toEqual({
      pathname: '/tournament/[tournamentId]',
      params: { tournamentId },
    });
    expect(
      parentRoute('tournament/[tournamentId]/team/[teamId]', { tournamentId, teamId: 'x' }, lookup),
    ).toEqual({ pathname: '/tournament/[tournamentId]', params: { tournamentId, tab: 'table' } });
    expect(parentRoute('tournament/[tournamentId]/team/[teamId]', {}, lookup)).toBe('/tournaments');
    expect(parentRoute('tournament/[tournamentId]/match', { tournamentId }, lookup)).toEqual({
      pathname: '/tournament/[tournamentId]',
      params: { tournamentId, tab: 'matches' },
    });
    expect(parentRoute('tournament/[tournamentId]/match', undefined, lookup)).toBe('/tournaments');
  });

  it('falls back to /teams when params or the match are missing', () => {
    expect(parentRoute('team/[teamId]/player', {}, lookup)).toBe('/teams');
    expect(parentRoute('team/[teamId]/match-new', { teamId: '' }, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/index', { matchId: 'nope' }, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/index', undefined, lookup)).toBe('/teams');
    expect(parentRoute('match/[matchId]/rotation', { matchId: 5 }, lookup)).toBe('/teams');
  });
});
