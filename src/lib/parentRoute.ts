import type { Href } from 'expo-router';

type Params = Record<string, unknown> | undefined;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/**
 * Where "Back" goes when there is no history (deep link / page reload): the logical parent screen.
 * The tab screens (teams, profile, settings) have no back button.
 * `teamIdOfMatch` looks up a match's team (from the store) so a match can go back to its team;
 * v7: `seasonIdOfMatch` (optional) its season, so it goes back to the season screen.
 */
export function parentRoute(
  routeName: string,
  params: Params,
  teamIdOfMatch: (matchId: string) => string | undefined,
  seasonIdOfMatch: (matchId: string) => string | undefined = () => undefined,
): Href {
  const teamId = str(params?.teamId);
  const matchId = str(params?.matchId);
  const seasonId = str(params?.seasonId);
  const set = str(params?.set);
  switch (routeName) {
    case 'team/[teamId]/player':
    case 'team/[teamId]/players/[playerId]':
      return teamId ? { pathname: '/team/[teamId]', params: { teamId } } : '/teams';
    case 'team/[teamId]/match-new':
    case 'team/[teamId]/season-new':
      // v7: a new match in a season / editing a season goes back to that season.
      if (teamId && seasonId) {
        return { pathname: '/team/[teamId]/season/[seasonId]', params: { teamId, seasonId } };
      }
      return teamId ? { pathname: '/team/[teamId]', params: { teamId, tab: 'matches' } } : '/teams';
    case 'team/[teamId]/season/[seasonId]':
      return teamId ? { pathname: '/team/[teamId]', params: { teamId, tab: 'matches' } } : '/teams';
    case 'team/[teamId]/preset/[presetId]':
      return teamId ? { pathname: '/team/[teamId]', params: { teamId, tab: 'presets' } } : '/teams';
    case 'team/[teamId]/starters':
      return teamId
        ? { pathname: '/team/[teamId]', params: { teamId, tab: 'starters' } }
        : '/teams';
    case 'match/[matchId]/index': {
      const matchTeam = matchId ? teamIdOfMatch(matchId) : undefined;
      const matchSeason = matchId ? seasonIdOfMatch(matchId) : undefined;
      if (matchTeam && matchSeason) {
        return {
          pathname: '/team/[teamId]/season/[seasonId]',
          params: { teamId: matchTeam, seasonId: matchSeason },
        };
      }
      return matchTeam
        ? { pathname: '/team/[teamId]', params: { teamId: matchTeam, tab: 'matches' } }
        : '/teams';
    }
    case 'match/[matchId]/rotation':
    case 'match/[matchId]/starters':
    case 'match/[matchId]/live':
    case 'match/[matchId]/stats':
    case 'match/[matchId]/performance':
      if (!matchId) return '/teams';
      return set
        ? { pathname: '/match/[matchId]', params: { matchId, set } }
        : { pathname: '/match/[matchId]', params: { matchId } };
    default:
      return '/teams';
  }
}
