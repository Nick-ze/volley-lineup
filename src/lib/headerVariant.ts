/**
 * v11: which screens open with a large title (browse screens: a team, a season, a player, the
 * account screens) and which with the compact one-row header (the match screens, the court
 * editors and the form modals, where height matters). By route name (`app/_layout.tsx`).
 */
export type HeaderVariant = 'compact' | 'large';

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

export function headerVariant(routeName: string): HeaderVariant {
  return LARGE_HEADER_ROUTES.has(routeName) ? 'large' : 'compact';
}
