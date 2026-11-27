import { PillTabBar, type IconName, type PillTabItem } from '@/components';
import { useT, type Strings } from '@/i18n';

import { TEAM_TABS, type TeamTab } from './tabs';

const ICONS: Record<TeamTab, { active: IconName; inactive: IconName }> = {
  roster: { active: 'people', inactive: 'people-outline' },
  matches: { active: 'calendar', inactive: 'calendar-outline' },
  presets: { active: 'bookmarks', inactive: 'bookmarks-outline' },
  starters: { active: 'star', inactive: 'star-outline' },
  stats: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};

const labels = (t: Strings, tab: TeamTab) => {
  const s = t.presets.nav;
  switch (tab) {
    case 'roster':
      return { label: s.roster, a11y: s.rosterLabel };
    case 'matches':
      return { label: s.matches, a11y: s.matchesLabel };
    case 'presets':
      return { label: s.presets, a11y: s.presetsLabel };
    case 'starters':
      return { label: s.starters, a11y: s.startersLabel };
    case 'stats':
      return { label: s.stats, a11y: s.statsLabel };
  }
};

export interface TeamNavBarProps {
  value: TeamTab;
  onChange: (tab: TeamTab) => void;
}

/**
 * Bottom nav bar inside the team screen: Roster · Matches · Presets · Starters · Stats. v11: the
 * same pill bar as the app's main tab bar (which is not shown on the team screen, so there is
 * only one bar).
 */
export function TeamNavBar({ value, onChange }: TeamNavBarProps) {
  const t = useT();
  const items: PillTabItem<TeamTab>[] = TEAM_TABS.map((tab) => {
    const { label, a11y } = labels(t, tab);
    return {
      key: tab,
      label,
      accessibilityHint: a11y,
      icon: ICONS[tab],
      testID: `team-tab-${tab}`,
    };
  });
  return (
    <PillTabBar
      items={items}
      value={value}
      onChange={onChange}
      accessibilityLabel={t.presets.nav.label}
      testID="team-nav"
    />
  );
}
