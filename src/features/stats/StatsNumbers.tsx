import { ScrollView, Text, View } from 'react-native';

import { useT } from '@/i18n';

import type { StatsColumn, StatsRow } from './StatsTable';
import { useStatsTableStyles } from './statsTableStyles';

export interface StatsNumbersProps {
  heading: string;
  columns: StatsColumn[];
  rows: StatsRow[];
  testID: string;
}

/**
 * The numeric columns of a `StatsTable`: scroll sideways when they don't fit. Hidden from screen
 * readers row by row — each row's sticky head cell speaks the whole row.
 */
export function StatsNumbers({ heading, columns, rows, testID }: StatsNumbersProps) {
  const styles = useStatsTableStyles();
  const t = useT();
  return (
    <ScrollView
      horizontal
      style={styles.scroller}
      accessibilityLabel={t.stats.tableScrollLabel(heading)}
    >
      <View>
        <View style={styles.row}>
          {columns.map((c) => (
            <Text
              key={c.key}
              style={[styles.cell, styles.header, styles.num]}
              accessibilityLabel={c.meaning}
            >
              {c.label}
            </Text>
          ))}
        </View>
        {rows.map((row) => (
          <View key={row.key} style={styles.row} importantForAccessibility="no-hide-descendants">
            {columns.map((c, i) => (
              <Text
                key={c.key}
                style={[styles.cell, styles.num]}
                testID={`${testID}-${row.key}-${c.key}`}
              >
                {row.cells[i]}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
