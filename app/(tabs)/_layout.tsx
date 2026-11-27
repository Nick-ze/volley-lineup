import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { useTabPager, VisibleScenes } from '@/components';
import { APP_TABS, AppTabPagerContext, useShownTab } from '@/features/appTabs/appTabs';
import { AppTabBar } from '@/features/appTabs/AppTabBar';
import { TabScene } from '@/features/appTabs/TabScene';
import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

/**
 * Bottom tab bar for the three top-level screens (Teams, Profile, Settings; v11: the pill bar
 * `AppTabBar`). Detail screens (team, match, …) live in the root Stack and are pushed over the
 * tabs, without a tab bar.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const shown = useShownTab();
  // v8.1.1: one pager for the three scenes; a drag that went on navigates to the new tab.
  const pager = useTabPager(APP_TABS.length, APP_TABS.indexOf(shown), (next) =>
    router.navigate(`/${APP_TABS[next]}`),
  );
  // Any tab counts as "past the picker": from now on `/` never auto-forwards (DECISIONS #28).
  useEffect(markStartupHandled, []);

  return (
    <AppTabPagerContext.Provider value={pager}>
      {/* Phones: the navigator's screens would hide inactive scenes (display: none). */}
      <VisibleScenes>
        <Tabs
          tabBar={(props) => <AppTabBar {...props} />}
          screenLayout={({ route, children }) => <TabScene name={route.name}>{children}</TabScene>}
          // v8.1.1: every scene stays mounted and visible (stacked, the focused one on top); the
          // pager places their content, so the navigator neither animates nor detaches them, and
          // `VisibleScenes` keeps the inactive ones drawn on phones.
          detachInactiveScreens={false}
          screenOptions={{
            animation: 'none',
            // All three tabs mount up front (phones too: the screens are light), so a drag always
            // shows the real neighbouring screen.
            lazy: false,
            // v11: no header — each tab screen opens with its title on the page.
            headerShown: false,
            // The scenes are see-through (the neighbour shows while dragging); `PagerScene`
            // carries the background.
            sceneStyle: { backgroundColor: colors.transparent },
          }}
        >
          <Tabs.Screen
            name="teams"
            options={{
              title: t.nav.teams,
              tabBarLabel: t.profile.tabs.teams,
              tabBarAccessibilityLabel: t.profile.tabs.teamsLabel,
              tabBarButtonTestID: 'tab-teams',
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t.profile.tabs.profile,
              tabBarLabel: t.profile.tabs.profile,
              tabBarAccessibilityLabel: t.profile.tabs.profileLabel,
              tabBarButtonTestID: 'tab-profile',
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: t.nav.settings,
              tabBarLabel: t.profile.tabs.settings,
              tabBarAccessibilityLabel: t.profile.tabs.settingsLabel,
              tabBarButtonTestID: 'tab-settings',
            }}
          />
        </Tabs>
      </VisibleScenes>
    </AppTabPagerContext.Provider>
  );
}
