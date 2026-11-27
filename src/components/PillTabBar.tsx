import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontSize, makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

import type { IconName } from './Button';

export interface PillTabItem<K extends string> {
  key: K;
  /** Visible text. */
  label: string;
  /** Screen-reader label; starts with the visible text (default: `label`). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Filled icon for the active tab, outline for the others. */
  icon: { active: IconName; inactive: IconName };
  testID: string;
}

export interface PillTabBarProps<K extends string> {
  items: readonly PillTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Name of the tab list for screen readers. */
  accessibilityLabel?: string;
  testID?: string;
}

/** Icon size (px). */
const ICON_SIZE = 22;

/**
 * v11: the bottom bar of the app tabs and of a team's tabs (DECISIONS #338) — one rounded bar on
 * the page background, the active tab on a soft orange marker. It takes its own room at the
 * bottom (no overlay) and adds the bottom safe area itself.
 */
export function PillTabBar<K extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: PillTabBarProps<K>) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View
        style={styles.bar}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {items.map((item) => {
          const selected = item.key === value;
          const tint = selected ? colors.primaryText : colors.textMuted;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              accessibilityHint={item.accessibilityHint}
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => onChange(item.key)}
              style={({ pressed }) => [
                styles.item,
                selected && styles.selected,
                pressed && styles.pressed,
              ]}
              testID={item.testID}
            >
              <Ionicons
                name={selected ? item.icon.active : item.icon.inactive}
                size={ICON_SIZE}
                color={tint}
              />
              <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  outer: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.round,
    backgroundColor: theme.colors.surface,
  },
  item: {
    flex: 1,
    minHeight: touchTarget + spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderRadius: radius.round,
  },
  selected: { backgroundColor: theme.colors.primarySoft },
  pressed: { opacity: 0.8 },
  // Five items share 375 px: the label may shrink a little rather than be cut off.
  // v8: the wide dyslexia font is set tighter so "Startsechs" fits too (v11: the items are a
  // little narrower inside the rounded bar).
  label: {
    ...typography.label,
    fontSize: fontSize.xs,
    paddingHorizontal: theme.dyslexiaFont ? 0 : spacing.xxs,
    ...(theme.dyslexiaFont ? { letterSpacing: -1 } : {}),
  },
}));
