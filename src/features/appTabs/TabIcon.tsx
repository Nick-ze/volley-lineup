import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  focused: boolean;
  color: ColorValue;
  size: number;
}

/** Filled icon for the active tab, outline for the others (decorative: the label is read). */
export function TabIcon({
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
