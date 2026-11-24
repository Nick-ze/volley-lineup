import { Pressable, Switch, Text, View } from 'react-native';

import { decorativeSwitchProps } from '@/lib/switchProps';
import { makeStyles, spacing, touchTarget, typography, useTheme } from '@/theme';

export interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** v9.1: read by screen readers with the switch (e.g. the visible hint under it). */
  accessibilityHint?: string;
  testID?: string;
}

/** A labelled on/off switch. The whole row is the (≥ 44 px) control; the Switch is only visual. */
export function ToggleRow({ label, value, onChange, accessibilityHint, testID }: ToggleRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      // aria-* (not accessibilityState) so react-native-web also exposes the state.
      aria-checked={value}
      onPress={() => onChange(!value)}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch
          value={value}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.text}
          {...decorativeSwitchProps(colors.text)}
        />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pressed: { opacity: 0.8 },
  label: { ...typography.body, color: theme.colors.text, flex: 1 },
}));
