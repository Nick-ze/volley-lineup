import { parseTab } from '@/lib/parseTab';

/** The sections of the team screen (`/team/[teamId]?tab=…`), in nav bar order. */
export const TEAM_TABS = ['roster', 'matches', 'presets', 'starters', 'stats'] as const;

export type TeamTab = (typeof TEAM_TABS)[number];

/** Parses `?tab=`; anything unknown (or missing) is the roster. */
export const parseTeamTab = (value: string | string[] | undefined): TeamTab =>
  parseTab(TEAM_TABS, value, 'roster');
