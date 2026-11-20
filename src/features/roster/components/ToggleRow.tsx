import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing, touchTarget, typography } from '@/theme';

export interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}

/** A labelled on/off switch. */
export function ToggleRow({ label, value, onChange, testID }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.text}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: { ...typography.body, color: colors.text, flex: 1 },
});
