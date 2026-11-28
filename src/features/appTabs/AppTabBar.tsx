import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { PillTabBar, type IconName, type PillTabItem } from '@/components';

import { isAppTab, type AppTab } from './appTabs';

/** What the navigator hands its tab bar. */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<AppTab, { active: IconName; inactive: IconName }> = {
  teams: { active: 'people', inactive: 'people-outline' },
  tournaments: { active: 'trophy', inactive: 'trophy-outline' },
  profile: { active: 'person-circle', inactive: 'person-circle-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
};

/**
 * v11: the app's bottom tab bar (Teams · Tournaments · Profile · Settings; v12: four tabs) as
 * the pill bar. It presses a tab the
 * way the navigator's own bar does — a `tabPress` event, then the navigation unless a listener
 * prevented it — so the pager in `app/(tabs)/_layout.tsx` keeps working.
 */
export function AppTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const items: PillTabItem<string>[] = state.routes.flatMap((route) => {
    if (!isAppTab(route.name)) return [];
    const options = descriptors[route.key]?.options;
    const label = typeof options?.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
    return [
      {
        key: route.key,
        label,
        accessibilityLabel: options?.tabBarAccessibilityLabel ?? label,
        icon: ICONS[route.name],
        testID: options?.tabBarButtonTestID ?? `tab-${route.name}`,
      },
    ];
  });
  const focused = state.routes[state.index]?.key ?? '';
  const press = (key: string) => {
    const event = emitter.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (key !== focused && !event.defaultPrevented) navigateToTab(key);
  };
  return <PillTabBar items={items} value={focused} onChange={press} testID="app-tab-bar" />;
}
