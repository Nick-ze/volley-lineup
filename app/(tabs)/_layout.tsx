import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useSegments } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactElement,
} from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PagerScene, useTabPager, type TabPager } from '@/components';
import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { useT } from '@/i18n';
import { fontSize, makeStyles, spacing, touchTarget, typography, useTheme } from '@/theme';

/** Bar height above the bottom safe area: a 44 px target plus room for the label. */
const TAB_BAR_HEIGHT = touchTarget + spacing.md;

type IconName = ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  focused: boolean;
  color: ColorValue;
  size: number;
}

/** Filled icon for the active tab, outline for the others (decorative: the label is read). */
function TabIcon({
  focused,
  color,
  size,
  active,
  inactive,
}: TabIconProps & {
  active: IconName;
  inactive: IconName;
}) {
  const { colors } = useTheme();
  // The tint is one of our theme colours (always a string); ColorValue also allows platform colours.
  const tint = typeof color === 'string' ? color : colors.textMuted;
  return <Ionicons name={focused ? active : inactive} size={size} color={tint} />;
}

/** The tabs in bar order (v8: swipe left → the next one). */
const APP_TABS = ['teams', 'profile', 'settings'] as const;
type AppTab = (typeof APP_TABS)[number];

const isAppTab = (name: string | undefined): name is AppTab =>
  (APP_TABS as readonly (string | undefined)[]).includes(name);

/** The app tab shown (the last one while a detail screen is pushed over the tabs). */
function useShownTab(): AppTab {
  const [group, name] = useSegments() as string[];
  const current = group === '(tabs)' && isAppTab(name) ? name : null;
  const [last, setLast] = useState<AppTab>(current ?? 'teams');
  if (current && current !== last) setLast(current);
  return current ?? last;
}

/** v8.1.1: the pager all three tab scenes share. */
const AppTabPagerContext = createContext<TabPager | null>(null);

/**
 * v8: a sideways swipe on a tab screen goes to the neighbouring tab. v8.1.1: the real screens
 * follow the finger (every scene stays mounted, at its slot for the shared pager position); a
 * drag that goes on navigates once the new screen is in place, and a tap or Back slides there.
 */
function TabScene({ name, children }: { name: string; children: ReactElement }) {
  const pager = useContext(AppTabPagerContext);
  if (!pager || !isAppTab(name)) return children;
  return (
    <PagerScene
      pager={pager}
      index={APP_TABS.indexOf(name)}
      count={APP_TABS.length}
      testID={`app-tab-swipe-${name}`}
    >
      {children}
    </PagerScene>
  );
}

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
      <Tabs
        screenLayout={({ route, children }) => <TabScene name={route.name}>{children}</TabScene>}
        // v8.1.1: every scene stays mounted and visible (stacked, the focused one on top); the
        // pager places their content, so the navigator neither animates nor detaches them.
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
    </AppTabPagerContext.Provider>
  );
}

// A style hook, so the dyslexia font reaches the tab labels.
const useStyles = makeStyles(() => ({
  tabLabel: { ...typography.label, fontSize: fontSize.xs },
}));
