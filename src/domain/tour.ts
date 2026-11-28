/**
 * v9.0 tutorial: which screens have tips, and whether a screen shows its tips, offers them or
 * stays quiet. Pure; the UI is in `src/features/tour/`.
 *
 * - Full tour: every screen shows its tips the first time it is opened.
 * - Quick tour: the quick path (profile → team → players → season → match → lineup) shows its
 *   tips; every other screen offers them once ("Quick tip for …?").
 * - No tour (or not chosen yet): nothing.
 *
 * A page counts as seen once its tips were shown or the offer was answered; it stays quiet
 * until a tour is chosen again (which clears the seen list).
 */
import type { TourMode, TourPage } from './types';

/** The quick tour's screens, in the order a new user walks through them. */
export const QUICK_PAGES = [
  'profiles',
  'teams',
  'roster',
  'playerForm',
  'matches',
  'seasonForm',
  'seasonMatches',
  'matchForm',
  'builder',
] as const satisfies readonly TourPage[];

/** Screens outside the quick tour (full tour: shown; quick tour: offered). */
export const OTHER_PAGES = [
  'profile',
  'settings',
  'presets',
  'starters',
  'teamStats',
  'playerDetail',
  'presetEditor',
  'startersEditor',
  'seasonOpponents',
  'seasonStats',
  'rotation',
  'matchStarters',
  'live',
  'performance',
  'matchStats',
  'account',
  'signIn',
  'cloudTeams',
  'members',
  'join',
  // v12: hosted tournaments (not in the quick tour, so it stays short).
  'tournaments',
  'tournamentForm',
  'tournamentTable',
  'tournamentMatches',
  'tournamentTeams',
  'tournamentTeam',
  'tournamentResult',
] as const satisfies readonly TourPage[];

/** Every page with tips (quick pages first). */
export const TOUR_PAGES: readonly TourPage[] = [...QUICK_PAGES, ...OTHER_PAGES];

/** The quick tour's last page (its last tip says where to find more). */
export const LAST_QUICK_PAGE: TourPage = 'builder';

const QUICK = new Set<TourPage>(QUICK_PAGES);

export const isQuickPage = (page: TourPage): boolean => QUICK.has(page);

export type TourAction = 'steps' | 'offer' | 'none';

/** What a screen does when it is opened: show its tips, offer them, or nothing. */
export function tourAction(
  mode: TourMode | null,
  seen: readonly TourPage[],
  page: TourPage | null,
): TourAction {
  if (page === null || mode === null || mode === 'none' || seen.includes(page)) return 'none';
  if (mode === 'full' || isQuickPage(page)) return 'steps';
  return 'offer';
}

/** `seen` with `page` added (the same list when it is already there). */
export const withSeen = (seen: readonly TourPage[], page: TourPage): TourPage[] =>
  seen.includes(page) ? [...seen] : [...seen, page];

/** The team screen's tabs (`/team/[teamId]?tab=`). */
export type TeamTabName = 'roster' | 'matches' | 'presets' | 'starters' | 'stats';
/** The season screen's tabs. */
export type SeasonTabName = 'matches' | 'opponents' | 'stats';
/** The live screen's views. */
export type LiveViewName = 'live' | 'performance';
/** v12: a hosted tournament's tabs. */
export type TournamentTabName = 'table' | 'matches' | 'teams';

const TEAM_TAB_PAGES: Record<TeamTabName, TourPage> = {
  roster: 'roster',
  matches: 'matches',
  presets: 'presets',
  starters: 'starters',
  stats: 'teamStats',
};

const SEASON_TAB_PAGES: Record<SeasonTabName, TourPage> = {
  matches: 'seasonMatches',
  opponents: 'seasonOpponents',
  stats: 'seasonStats',
};

const LIVE_VIEW_PAGES: Record<LiveViewName, TourPage> = {
  live: 'live',
  performance: 'performance',
};

const TOURNAMENT_TAB_PAGES: Record<TournamentTabName, TourPage> = {
  table: 'tournamentTable',
  matches: 'tournamentMatches',
  teams: 'tournamentTeams',
};

/** The page of the team screen's shown tab. */
export const teamTabPage = (tab: TeamTabName): TourPage => TEAM_TAB_PAGES[tab];
/** The page of the season screen's shown tab. */
export const seasonTabPage = (tab: SeasonTabName): TourPage => SEASON_TAB_PAGES[tab];
/** The page of the live screen's shown view (Live / Performance). */
export const liveViewPage = (view: LiveViewName): TourPage => LIVE_VIEW_PAGES[view];
/** v12: the page of a hosted tournament's shown tab. */
export const tournamentTabPage = (tab: TournamentTabName): TourPage => TOURNAMENT_TAB_PAGES[tab];
