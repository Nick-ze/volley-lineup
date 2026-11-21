import { playerStatRows, type PlayerStats, type Stats } from '@/domain/stats';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { touchTarget } from '@/theme';

import { StatsTable, type StatsColumn } from './StatsTable';

/** Each column: the stat and its strings key in `t.stats.players`. */
const COLUMNS = [
  ['setsStarted', 'started'],
  ['setsPlayed', 'played'],
  ['subIn', 'subIn'],
  ['subOut', 'subOut'],
  ['serveTurns', 'serveTurns'],
  ['servePoints', 'servePoints'],
  ['kills', 'kills'],
  ['aces', 'aces'],
  ['blocks', 'blocks'],
  ['errors', 'errors'],
] as const satisfies readonly (readonly [keyof PlayerStats, string])[];

/** Name column: room for "#12 Firstname". */
const NAME_WIDTH = touchTarget * 3;

export interface PlayerTableProps {
  stats: Stats;
  players: readonly Player[];
  testID?: string;
}

/** Per player: sets started / played, in / out, serve turns, points on serve and tag totals. */
export function PlayerTable({ stats, players, testID = 'player-table' }: PlayerTableProps) {
  const t = useT();
  const p = t.stats.players;
  const columns: StatsColumn[] = COLUMNS.map(([key, label]) => ({
    key,
    label: p[label],
    meaning: p[`${label}Label`],
  }));
  const rows = playerStatRows(stats, players).map(({ player, stats: line }) => ({
    key: player.id,
    head: `#${player.number} ${player.firstName}`,
    headLabel: `#${player.number} ${player.firstName} ${player.lastName}`.trim(),
    cells: COLUMNS.map(([key]) => String(line[key])),
  }));
  return (
    <StatsTable
      heading={p.heading}
      head={{ key: 'head', label: p.head, meaning: p.headLabel }}
      columns={columns}
      rows={rows}
      headWidth={NAME_WIDTH}
      testID={testID}
    />
  );
}
