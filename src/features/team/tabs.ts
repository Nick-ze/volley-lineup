/** The sections of the team screen (`/team/[teamId]?tab=…`), in nav bar order. */
export const TEAM_TABS = ['roster', 'matches', 'presets', 'starters', 'stats'] as const;

export type TeamTab = (typeof TEAM_TABS)[number];

/** Parses `?tab=`; anything unknown (or missing) is the roster. */
export function parseTeamTab(value: string | string[] | undefined): TeamTab {
  const v = Array.isArray(value) ? value[0] : value;
  return (TEAM_TABS as readonly string[]).includes(v ?? '') ? (v as TeamTab) : 'roster';
}
