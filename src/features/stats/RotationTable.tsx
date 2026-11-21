import { sideOutRate, type RotationStats, type Stats } from '@/domain/stats';
import { useT, type Strings } from '@/i18n';

import { StatsTable, type StatsColumn } from './StatsTable';

const KEYS = ['won', 'lost', 'sideOut', 'breakPoints'] as const;

/** "67%", or "–" without received rallies. */
export function sideOutText(t: Strings, line: RotationStats): string {
  const rate = sideOutRate(line);
  return rate === null ? t.stats.none : t.stats.percent(Math.round(rate * 100));
}

export interface RotationTableProps {
  stats: Stats;
  testID?: string;
}

/**
 * Rotations 1–6 (named after the setter's position, v4): points won / lost, side-out % and break
 * points.
 */
export function RotationTable({ stats, testID = 'rotation-table' }: RotationTableProps) {
  const t = useT();
  const r = t.stats.rotations;
  const columns: StatsColumn[] = KEYS.map((key) => ({
    key,
    label: r[key],
    meaning: r[`${key}Label`],
  }));
  const rows = stats.rotations.map((line) => ({
    key: `r${line.rotation}`,
    head: r.row(line.rotation),
    headLabel: r.rowLabel(line.rotation),
    cells: [String(line.won), String(line.lost), sideOutText(t, line), String(line.breakPoints)],
  }));
  return (
    <StatsTable
      heading={r.heading}
      head={{ key: 'head', label: r.head, meaning: r.headLabel }}
      columns={columns}
      rows={rows}
      note={r.numbering}
      testID={testID}
    />
  );
}
