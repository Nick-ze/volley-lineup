import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Tabs, type BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { useEffect, type ComponentProps, type ReactElement } from 'react';
import type { ColorValue } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeTabs } from '@/components';
import { SLIDE_DURATION_MS, SLIDE_FALLBACK_DISTANCE, TAB_SCENE_OPACITY } from '@/domain/tabMotion';

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

/**
 * v8: the chosen tab slides in from its side (the bar's `shift` animation: screens right of the
 * focused one sit at progress 1, left ones at -1) while the old one fades out. Scenes resting at
 * ±1 are hidden (v8 QA), so a skipped middle tab never shows through the slide.
 */
const slideScenes: NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']> = ({
  current,
}) => ({
  sceneStyle: {
    opacity: current.progress.interpolate(TAB_SCENE_OPACITY),
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-SLIDE_FALLBACK_DISTANCE, 0, SLIDE_FALLBACK_DISTANCE],
        }),
      },
    ],
  },
});

const isAppTab = (name: string): name is AppTab => (APP_TABS as readonly string[]).includes(name);

/** v8: a sideways swipe on a tab screen goes to the neighbouring tab. */
function TabSwipe({ name, children }: { name: string; children: ReactElement }) {
  const router = useRouter();
  if (!isAppTab(name)) return children;
  return (
    <SwipeTabs
      tabs={APP_TABS}
      value={name}
      onChange={(next) => router.navigate(`/${next}`)}
      testID={`app-tab-swipe-${name}`}
      size="fill"
    >
      {children}
    </SwipeTabs>
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
  const reduceMotion = useReducedMotion();
  // Any tab counts as "past the picker": from now on `/` never auto-forwards (DECISIONS #28).
  useEffect(markStartupHandled, []);

  return (
    <Tabs
      screenLayout={({ route, children }) => <TabSwipe name={route.name}>{children}</TabSwipe>}
      screenOptions={{
        // v8: slide between tabs; the OS "reduce motion" setting switches tabs instantly.
        animation: reduceMotion ? 'none' : 'shift',
        transitionSpec: { animation: 'timing', config: { duration: SLIDE_DURATION_MS } },
        sceneStyleInterpolator: slideScenes,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
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
  );
}

// A style hook, so the dyslexia font reaches the tab labels.
const useStyles = makeStyles(() => ({
  tabLabel: { ...typography.label, fontSize: fontSize.xs },
}));
