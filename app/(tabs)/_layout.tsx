import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, type ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { useT } from '@/i18n';
import { fontSize, spacing, touchTarget, typography, useTheme } from '@/theme';

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

/**
 * Bottom tab bar for the three top-level screens (Teams, Profile, Settings). Detail screens
 * (team, match, …) live in the root Stack and are pushed over the tabs, without a tab bar.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  // Any tab counts as "past the picker": from now on `/` never auto-forwards (DECISIONS #28).
  useEffect(markStartupHandled, []);

  return (
    <Tabs
      screenOptions={{
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { minHeight: touchTarget },
        tabBarLabelStyle: { ...typography.label, fontSize: fontSize.xs },
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
