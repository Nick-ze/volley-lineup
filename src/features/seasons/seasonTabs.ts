import { parseTab } from '@/components/parseTab';

/** The sections of the season screen (`?tab=…`), in tab order. */
export const SEASON_TABS = ['matches', 'opponents', 'stats'] as const;

export type SeasonTab = (typeof SEASON_TABS)[number];

/** Parses `?tab=`; anything unknown (or missing) is the match list. */
export const parseSeasonTab = (value: string | string[] | undefined): SeasonTab =>
  parseTab(SEASON_TABS, value, 'matches');
