import Ionicons from '@expo/vector-icons/Ionicons';
import { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontSize, makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

import type { IconName } from './Button';
import { PRESS_SCALE, SPRING } from './motion';

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
/** Room between the bar's edge and its items. */
const BAR_PADDING = spacing.xs;

/**
 * v11: the bottom bar of the app tabs and of a team's tabs (DECISIONS #338) — one rounded bar on
 * the page background, the active tab on a soft orange marker that slides to a newly chosen tab
 * (not with "reduce motion"). It takes its own room at the bottom (no overlay) and adds the
 * bottom safe area itself.
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
  // The marker slides to the active tab once the bar knows its width; until then (and in
  // tests, where nothing is laid out) the active item carries the soft colour itself.
  const [barWidth, setBarWidth] = useState(0);
  const itemWidth = barWidth > 0 ? (barWidth - 2 * BAR_PADDING) / items.length : 0;
  const index = Math.max(
    0,
    items.findIndex((item) => item.key === value),
  );
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const placed = itemWidth > 0;
  const moved = useRef(false);
  useLayoutEffect(() => {
    if (itemWidth === 0) return;
    const target = index * itemWidth;
    // The first placement and "reduce motion" jump; a change of tab slides.
    x.value = moved.current && !reduceMotion ? withSpring(target, SPRING) : target;
    moved.current = true;
    // Shared values are stable; only the target and the setting matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, itemWidth, reduceMotion]);
  const markerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);
  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View
        style={styles.bar}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        onLayout={onLayout}
        testID={testID}
      >
        {placed ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.marker, { width: itemWidth }, markerStyle]}
            testID={testID ? `${testID}-marker` : undefined}
          />
        ) : null}
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
                selected && !placed && styles.selected,
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
    padding: BAR_PADDING,
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
  marker: {
    position: 'absolute',
    left: BAR_PADDING,
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    borderRadius: radius.round,
    backgroundColor: theme.colors.primarySoft,
  },
  pressed: { opacity: 0.8, transform: [{ scale: PRESS_SCALE }] },
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
