import { Pressable, Text, View } from 'react-native';

import { useT } from '@/i18n';
import {
  borderWidth,
  makeStyles,
  profileColors,
  radius,
  spacing,
  touchTarget,
  typography,
} from '@/theme';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

/** Radio group of the profile avatar colours. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const styles = useStyles();
  const t = useT();
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
              aria-checked={selected}
              onPress={() => onChange(c)}
              style={[styles.swatch, { backgroundColor: c }, selected && styles.selected]}
            />
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: theme.colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.round,
    borderWidth: borderWidth.thick,
    borderColor: theme.colors.transparent,
  },
  selected: { borderColor: theme.colors.text },
}));
