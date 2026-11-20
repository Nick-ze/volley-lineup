import { colors } from '@/theme';

/**
 * Web-only props for a purely decorative `Switch` inside a pressable row.
 * - `activeThumbColor`: react-native-web otherwise paints the "on" thumb teal.
 * - `disabled`: keeps the hidden native checkbox out of the tab order / click handling (the row
 *   is the control). With every colour given explicitly, RN-web renders it un-dimmed.
 */
export const decorativeSwitchProps = {
  activeThumbColor: colors.text,
  disabled: true,
} as const;
