import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n/en';
import { colors, profileColors, radius, spacing, touchTarget, typography } from '@/theme';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

/** Radio group of the profile avatar colours. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t.roster.profiles.color}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {profileColors.map((c, i) => {
          const selected = c === value;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={t.roster.profiles.colorOption(i + 1)}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(c)}
              style={[styles.swatch, { backgroundColor: c }, selected && styles.selected]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.round,
    borderWidth: 3,
    borderColor: colors.transparent,
  },
  selected: { borderColor: colors.text },
});
