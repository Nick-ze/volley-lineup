import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SET_NUMBERS, type SetNumber } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

export interface SetTabsProps {
  selected: SetNumber;
  /** Sets that already have a saved lineup (shown with a solid border). */
  existing: SetNumber[];
  onSelect(n: SetNumber): void;
}

/** Tabs for sets 1–5. The selected set is yellow. */
export function SetTabs({ selected, existing, onSelect }: SetTabsProps) {
  const t = useT();
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={t.lineup.setTabs}>
      {SET_NUMBERS.map((n) => {
        const active = n === selected;
        return (
          <Pressable
            key={n}
            accessibilityRole="tab"
            accessibilityLabel={t.lineup.setTab(n)}
            accessibilityHint={t.lineup.setTabHint}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(n)}
            style={[styles.tab, existing.includes(n) && styles.existing, active && styles.active]}
            testID={`set-tab-${n}`}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{t.lineup.setTab(n)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  existing: { borderStyle: 'solid', borderColor: colors.textMuted },
  active: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  label: { ...typography.label, color: colors.text },
  activeLabel: { color: colors.onHighlight },
});
