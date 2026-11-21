import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { listStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

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
  /** Width of the sticky first column. */
  headWidth?: number;
  testID: string;
}

/** Row height and width of a numeric column. */
const ROW_HEIGHT = spacing.xxl;
const CELL_WIDTH = touchTarget;

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
  headWidth = touchTarget * 1.5,
  testID,
}: StatsTableProps) {
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
        <ScrollView
          horizontal
          style={styles.scroller}
          accessibilityLabel={s.tableScrollLabel(heading)}
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
              <View
                key={row.key}
                style={styles.row}
                importantForAccessibility="no-hide-descendants"
              >
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
      </View>
      <Text style={styles.legend}>
        {columns.map((c) => s.legend(c.label, c.meaning)).join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  heading: listStyles.title,
  // As wide as its columns, but never wider than the screen (then the numbers scroll).
  table: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  scroller: { flexGrow: 0, flexShrink: 1 },
  row: { flexDirection: 'row' },
  cell: {
    ...typography.body,
    color: colors.text,
    height: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headCell: { paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceRaised },
  header: { ...typography.label, color: colors.textMuted, lineHeight: ROW_HEIGHT },
  num: { width: CELL_WIDTH, textAlign: 'center' },
  legend: { ...typography.caption, color: colors.textMuted },
});
