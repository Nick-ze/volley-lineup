import { StyleSheet, View } from 'react-native';

import type { SetNumber } from '@/domain/types';
import { spacing } from '@/theme';

import { ChoiceChip } from './ChoiceChip';

/** The texts of a set filter (`t.stats.filter`, `t.performance.filter`). */
export interface SetChipFilterStrings {
  label: string;
  all: string;
  allLabel: string;
  set: (n: number) => string;
  setLabel: (n: number) => string;
}

export interface SetChipFilterProps {
  /** The played sets to offer. */
  sets: readonly SetNumber[];
  /** null = all sets. */
  value: SetNumber | null;
  onChange: (value: SetNumber | null) => void;
  strings: SetChipFilterStrings;
  /** testIDs `<prefix>-all`, `<prefix>-1` … */
  testIDPrefix: string;
  /** Where the "All sets" chip goes. */
  allPosition: 'first' | 'last';
}

/** All sets + Set 1 … Set 5 (only played sets) as chips that wrap, "All sets" first or last. */
export function SetChipFilter({
  sets,
  value,
  onChange,
  strings: f,
  testIDPrefix,
  allPosition,
}: SetChipFilterProps) {
  const all = (
    <ChoiceChip
      role="tab"
      label={f.all}
      accessibilityLabel={f.allLabel}
      selected={value === null}
      onPress={() => onChange(null)}
      testID={`${testIDPrefix}-all`}
    />
  );
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={f.label}>
      {allPosition === 'first' ? all : null}
      {sets.map((n) => (
        <ChoiceChip
          key={n}
          role="tab"
          label={f.set(n)}
          accessibilityLabel={f.setLabel(n)}
          selected={value === n}
          onPress={() => onChange(n)}
          testID={`${testIDPrefix}-${n}`}
        />
      ))}
      {allPosition === 'last' ? all : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
