import type { Href } from 'expo-router';

type Params = Record<string, unknown> | undefined;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/**
 * Where "Back" goes when there is no history (deep link / page reload): the logical parent screen.
 * `teamIdOfMatch` looks up a match's team (from the store) so a match can go back to its team.
 */
export function parentRoute(
  routeName: string,
  params: Params,
  teamIdOfMatch: (matchId: string) => string | undefined,
): Href {
  const teamId = str(params?.teamId);
  const matchId = str(params?.matchId);
  switch (routeName) {
    case 'team/[teamId]/player':
      return teamId ? { pathname: '/team/[teamId]', params: { teamId } } : '/teams';
    case 'team/[teamId]/match-new':
      return teamId ? { pathname: '/team/[teamId]', params: { teamId, tab: 'matches' } } : '/teams';
    case 'match/[matchId]/index': {
      const matchTeam = matchId ? teamIdOfMatch(matchId) : undefined;
      return matchTeam
        ? { pathname: '/team/[teamId]', params: { teamId: matchTeam, tab: 'matches' } }
        : '/teams';
    }
    case 'match/[matchId]/rotation':
    case 'match/[matchId]/starters':
      if (!matchId) return '/teams';
      return str(params?.set)
        ? { pathname: '/match/[matchId]', params: { matchId, set: str(params?.set) as string } }
        : { pathname: '/match/[matchId]', params: { matchId } };
    case 'teams':
      return '/';
    default:
      return '/teams';
  }
}
