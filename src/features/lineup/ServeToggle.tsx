import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n/en';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

/** Two-option switch: we serve first / opponent serves first. */
export function ServeToggle({
  weServeFirst,
  onChange,
}: {
  weServeFirst: boolean;
  onChange(value: boolean): void;
}) {
  const option = (value: boolean, label: string, testID: string) => {
    const active = weServeFirst === value;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: active }}
        onPress={() => onChange(value)}
        style={[styles.option, active && styles.active]}
        testID={testID}
      >
        <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.lineup.serveLabel}
    >
      {option(true, t.lineup.weServe, 'serve-us')}
      {option(false, t.lineup.theyServe, 'serve-them')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.primary },
  label: { ...typography.label, color: colors.text, textAlign: 'center' },
  activeLabel: { color: colors.onPrimary },
});
