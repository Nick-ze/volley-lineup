import { Text, View } from 'react-native';

import { useT } from '@/i18n';
import { touchTarget } from '@/theme';

import { StatsNumbers } from './StatsNumbers';
import { useStatsTableStyles } from './statsTableStyles';

export interface StatsColumn {
  key: string;
  /** Short header (abbreviation). */
  label: string;
  /** What the abbreviation means (legend and screen readers). */
  meaning: string;
}

export interface StatsRow {
  key: string;
  /** First (sticky) column: e.g. "R1" or "#7 Lea". */
  head: string;
  /** Spoken name of the row, e.g. "Rotation 1" (defaults to `head`). */
  headLabel?: string;
  /** One value per column, already formatted. */
  cells: string[];
}

export interface StatsTableProps {
  heading: string;
  /** Header of the first column, with its meaning. */
  head: StatsColumn;
  columns: StatsColumn[];
  rows: StatsRow[];
  /** Extra explanation under the legend (e.g. how rotations are numbered). */
  note?: string;
  /** Width of the sticky first column. */
  headWidth?: number;
  testID: string;
}

/**
 * A compact table: the first column stays put, the numeric columns scroll sideways when they
 * don't fit (375 px phones). Headers are abbreviations; a legend under the table and each row's
 * screen-reader summary spell them out.
 */
export function StatsTable({
  heading,
  head,
  columns,
  rows,
  note,
  headWidth = touchTarget * 1.5,
  testID,
}: StatsTableProps) {
  const styles = useStatsTableStyles();
  const t = useT();
  const s = t.stats;
  const summary = (row: StatsRow) =>
    s.rowSummary(
      row.headLabel ?? row.head,
      columns.map((c, i) => s.cellSummary(c.meaning, row.cells[i] ?? '')).join(', '),
    );
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.heading} accessibilityRole="header">
        {heading}
      </Text>
      <View style={styles.table}>
        <View style={{ width: headWidth }}>
          <Text
            style={[styles.cell, styles.header, styles.headCell]}
            accessibilityLabel={head.meaning}
          >
            {head.label}
          </Text>
          {rows.map((row) => (
            <Text
              key={row.key}
              style={[styles.cell, styles.headCell]}
              numberOfLines={1}
              accessibilityLabel={summary(row)}
              testID={`${testID}-${row.key}`}
            >
              {row.head}
            </Text>
          ))}
        </View>
        <StatsNumbers heading={heading} columns={columns} rows={rows} testID={testID} />
      </View>
      <Text style={styles.legend}>
        {columns.map((c) => s.legend(c.label, c.meaning)).join(' · ')}
      </Text>
      {note ? (
        <Text style={styles.legend} testID={`${testID}-note`}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
