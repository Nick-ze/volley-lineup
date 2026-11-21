import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT, type Strings } from '@/i18n';
import { colors, fontSize, spacing, touchTarget, typography } from '@/theme';

import { TEAM_TABS, type TeamTab } from './tabs';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Icon size, matching the app's main tab bar. */
const ICON_SIZE = 22;

const ICONS: Record<TeamTab, { active: IconName; inactive: IconName }> = {
  roster: { active: 'people', inactive: 'people-outline' },
  matches: { active: 'calendar', inactive: 'calendar-outline' },
  presets: { active: 'bookmarks', inactive: 'bookmarks-outline' },
  starters: { active: 'star', inactive: 'star-outline' },
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
  }
};

export interface TeamNavBarProps {
  value: TeamTab;
  onChange: (tab: TeamTab) => void;
}

/**
 * Bottom nav bar inside the team screen: Roster · Matches · Presets · Starters. Styled like the
 * app's main tab bar (which is not shown on the team screen, so there is only one bar).
 */
export function TeamNavBar({ value, onChange }: TeamNavBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom }]}
      accessibilityRole="tablist"
      accessibilityLabel={t.presets.nav.label}
      testID="team-nav"
    >
      {TEAM_TABS.map((tab) => {
        const selected = tab === value;
        const tint = selected ? colors.primary : colors.textMuted;
        const { label, a11y } = labels(t, tab);
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityHint={a11y}
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => onChange(tab)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            testID={`team-tab-${tab}`}
          >
            <Ionicons
              name={selected ? ICONS[tab].active : ICONS[tab].inactive}
              size={ICON_SIZE}
              color={tint}
            />
            <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    minHeight: touchTarget + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.8 },
  label: { ...typography.label, fontSize: fontSize.xs },
});
