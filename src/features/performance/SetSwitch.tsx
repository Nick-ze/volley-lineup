import { StyleSheet, View } from 'react-native';

import type { SetNumber } from '@/domain/types';
import { ChoiceChip } from '@/features/roster/components/ChoiceChip';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

export interface SetSwitchProps {
  /** The played sets. */
  sets: readonly SetNumber[];
  /** null = all sets. */
  value: SetNumber | null;
  onChange: (value: SetNumber | null) => void;
}

/** Set 1 … Set 5 (played sets only) and All sets. */
export function SetSwitch({ sets, value, onChange }: SetSwitchProps) {
  const t = useT();
  const f = t.performance.filter;
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={f.label}>
      {sets.map((n) => (
        <ChoiceChip
          key={n}
          role="tab"
          label={f.set(n)}
          accessibilityLabel={f.setLabel(n)}
          selected={value === n}
          onPress={() => onChange(n)}
          testID={`perf-set-${n}`}
        />
      ))}
      <ChoiceChip
        role="tab"
        label={f.all}
        accessibilityLabel={f.allLabel}
        selected={value === null}
        onPress={() => onChange(null)}
        testID="perf-set-all"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
