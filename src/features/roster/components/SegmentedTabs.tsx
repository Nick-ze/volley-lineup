import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { ChoiceChip } from './ChoiceChip';

export interface SegmentedTabsProps<K extends string> {
  tabs: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
}

/** A row of equal-width tabs. */
export function SegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedTabsProps<K>) {
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {tabs.map((tab) => (
        <ChoiceChip
          key={tab.key}
          role="tab"
          label={tab.label}
          selected={tab.key === value}
          onPress={() => onChange(tab.key)}
          style={styles.tab}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  tab: { flex: 1 },
});
