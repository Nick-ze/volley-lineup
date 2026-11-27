/**
 * v11: which screens open with a large title (browse screens: a team, a season, a player, the
 * account screens) and which with the compact one-row header (the match screens, the court
 * editors and the form modals, where height matters). By route name (`app/_layout.tsx`).
 */
export type HeaderVariant = 'compact' | 'large' | 'bare';

const LARGE_HEADER_ROUTES: ReadonlySet<string> = new Set([
  'team/[teamId]/index',
  'team/[teamId]/season/[seasonId]',
  'team/[teamId]/players/[playerId]',
  'team/[teamId]/members',
  'account/index',
  'account/sign-in',
  'account/teams',
  'join',
]);

/**
 * Screens whose page opens with its own heading that names the opponent ("Performance vs
 * Rivals"; long names wrap there): the header shows only the back button, so the title isn't
 * said twice.
 */
const BARE_HEADER_ROUTES: ReadonlySet<string> = new Set([
  'match/[matchId]/performance',
  'match/[matchId]/stats',
]);

export function headerVariant(routeName: string): HeaderVariant {
  if (LARGE_HEADER_ROUTES.has(routeName)) return 'large';
  return BARE_HEADER_ROUTES.has(routeName) ? 'bare' : 'compact';
}
