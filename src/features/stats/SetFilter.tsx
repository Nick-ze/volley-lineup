import { StyleSheet, View } from 'react-native';

import type { SetNumber } from '@/domain/types';
import { ChoiceChip } from '@/features/roster/components/ChoiceChip';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

export interface SetFilterProps {
  /** The played sets to offer. */
  sets: readonly SetNumber[];
  /** null = all sets. */
  value: SetNumber | null;
  onChange: (value: SetNumber | null) => void;
}

/** All sets / Set 1 … Set 5 (only played sets). */
export function SetFilter({ sets, value, onChange }: SetFilterProps) {
  const t = useT();
  const f = t.stats.filter;
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={f.label}>
      <ChoiceChip
        role="tab"
        label={f.all}
        accessibilityLabel={f.allLabel}
        selected={value === null}
        onPress={() => onChange(null)}
        testID="stats-set-all"
      />
      {sets.map((n) => (
        <ChoiceChip
          key={n}
          role="tab"
          label={f.set(n)}
          accessibilityLabel={f.setLabel(n)}
          selected={value === n}
          onPress={() => onChange(n)}
          testID={`stats-set-${n}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
