/** The sections of the season screen (`?tab=…`), in tab order. */
export const SEASON_TABS = ['matches', 'opponents', 'stats'] as const;

export type SeasonTab = (typeof SEASON_TABS)[number];

/** Parses `?tab=`; anything unknown (or missing) is the match list. */
export function parseSeasonTab(value: string | string[] | undefined): SeasonTab {
  const v = Array.isArray(value) ? value[0] : value;
  return (SEASON_TABS as readonly string[]).includes(v ?? '') ? (v as SeasonTab) : 'matches';
}
