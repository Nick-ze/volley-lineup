import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabPager, VisibleScenes } from '@/components';
import { APP_TABS, AppTabPagerContext, useShownTab } from '@/features/appTabs/appTabs';
import { TabIcon } from '@/features/appTabs/TabIcon';
import { TabScene } from '@/features/appTabs/TabScene';
import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { useT } from '@/i18n';
import { fontSize, makeStyles, spacing, touchTarget, typography, useTheme } from '@/theme';

/** Bar height above the bottom safe area: a 44 px target plus room for the label. */
const TAB_BAR_HEIGHT = touchTarget + spacing.md;

/**
 * Bottom tab bar for the three top-level screens (Teams, Profile, Settings). Detail screens
 * (team, match, …) live in the root Stack and are pushed over the tabs, without a tab bar.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
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
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
            // The scenes are see-through (the neighbour shows while dragging); `PagerScene`
            // carries the background.
            sceneStyle: { backgroundColor: colors.transparent },
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              // A custom height replaces the default, so the bottom safe area is added here.
              height: TAB_BAR_HEIGHT + insets.bottom,
            },
            tabBarActiveTintColor: colors.primaryText,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarItemStyle: { minHeight: touchTarget },
            tabBarLabelStyle: styles.tabLabel,
          }}
        >
          <Tabs.Screen
            name="teams"
            options={{
              title: t.nav.teams,
              tabBarLabel: t.profile.tabs.teams,
              tabBarAccessibilityLabel: t.profile.tabs.teamsLabel,
              tabBarButtonTestID: 'tab-teams',
              tabBarIcon: (p) => <TabIcon {...p} active="people" inactive="people-outline" />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t.profile.tabs.profile,
              tabBarLabel: t.profile.tabs.profile,
              tabBarAccessibilityLabel: t.profile.tabs.profileLabel,
              tabBarButtonTestID: 'tab-profile',
              tabBarIcon: (p) => (
                <TabIcon {...p} active="person-circle" inactive="person-circle-outline" />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: t.nav.settings,
              tabBarLabel: t.profile.tabs.settings,
              tabBarAccessibilityLabel: t.profile.tabs.settingsLabel,
              tabBarButtonTestID: 'tab-settings',
              tabBarIcon: (p) => <TabIcon {...p} active="settings" inactive="settings-outline" />,
            }}
          />
        </Tabs>
      </VisibleScenes>
    </AppTabPagerContext.Provider>
  );
}

// A style hook, so the dyslexia font reaches the tab labels.
const useStyles = makeStyles(() => ({
  tabLabel: { ...typography.label, fontSize: fontSize.xs },
}));
