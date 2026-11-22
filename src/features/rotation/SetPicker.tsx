import { Pressable, Text, View } from 'react-native';

import type { SetNumber } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

export interface SetPickerProps {
  sets: readonly SetNumber[];
  selected: SetNumber;
  onSelect: (set: SetNumber) => void;
}

/** Tabs for the sets that exist in the match. The selected set is yellow. */
export function SetPicker({ sets, selected, onSelect }: SetPickerProps) {
  const styles = useStyles();
  const t = useT();
  return (
    <View
      style={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel={t.rotation.setPickerLabel}
    >
      {sets.map((n) => {
        const active = n === selected;
        return (
          <Pressable
            key={n}
            accessibilityRole="tab"
            accessibilityLabel={t.rotation.setTabLabel(n)}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(n)}
            testID={`set-tab-${n}`}
            style={({ pressed }) => [
              styles.tab,
              active && styles.active,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{t.rotation.setTab(n)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tab: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: theme.colors.highlight, borderColor: theme.colors.highlight },
  pressed: { opacity: 0.8 },
  label: { ...typography.label, color: theme.colors.text },
  activeLabel: { color: theme.colors.onHighlight },
}));
