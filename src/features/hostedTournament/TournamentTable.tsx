import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, PRESS_SCALE, useFormStyles } from '@/components';
import { standings, tableCounts, type Standing } from '@/domain/hostedTournament';
import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { useHostedResults, useHostedTeams } from '@/store';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

import { TablePdfButton } from './TablePdfButton';
import { pointsUnit, standingParts } from './tournamentText';

export interface TournamentTableProps {
  tournament: HostedTournament;
  /** Tapping a row opens that team's matches. */
  onOpenTeam: (teamId: string) => void;
}

/**
 * The table as a list of rows, not a grid (no sideways scrolling): the rank as a large number,
 * the name, one line "4 played · 3–1 · sets 7:3 · balls +24", and at the right the table points
 * over what they count. A line under the list explains the ranking order; v12.3: under it
 * "Table (PDF)" prints the table and the results.
 */
export function TournamentTable({ tournament, onOpenTeam }: TournamentTableProps) {
  const formStyles = useFormStyles();
  const t = useT();
  const s = t.tournament.table;
  const teams = useHostedTeams(tournament.id);
  const results = useHostedResults(tournament.id);
  const { id, plan, setsPerMatch, matchEnd } = tournament;
  const table = useMemo(
    () => standings({ id, plan, setsPerMatch, matchEnd }, teams, results),
    [id, plan, setsPerMatch, matchEnd, teams, results],
  );

  if (table.length < 2) return <EmptyState testID="table-empty">{s.empty}</EmptyState>;

  return (
    <View style={styles.wrap}>
      <View style={styles.list} testID="table-list">
        {table.map((standing) => (
          <TableRow
            key={standing.team.id}
            standing={standing}
            tournament={tournament}
            onPress={() => onOpenTeam(standing.team.id)}
          />
        ))}
      </View>
      <Text style={[formStyles.hint, styles.explain]} testID="table-explain">
        {s.explain[tableCounts(tournament)]}
      </Text>
      <TablePdfButton tournament={tournament} />
    </View>
  );
}

function TableRow({
  standing,
  tournament,
  onPress,
}: {
  standing: Standing;
  tournament: HostedTournament;
  onPress: () => void;
}) {
  const row = useRowStyles();
  const t = useT();
  const s = t.tournament.table;
  const parts = standingParts(t, standing, tournament);
  const unit = pointsUnit(t, tournament);
  const line = parts.join(t.tournament.metaSeparator);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={s.rowLabel(
        standing.rank,
        standing.team.name,
        line,
        standing.points,
        unit,
      )}
      onPress={onPress}
      style={({ pressed }) => [row.row, pressed && row.pressed]}
      testID={`table-row-${standing.team.id}`}
    >
      <Text style={row.rank} testID={`table-rank-${standing.team.id}`}>
        {standing.rank}
      </Text>
      <View style={row.text}>
        <Text style={row.name} numberOfLines={1}>
          {standing.team.name}
        </Text>
        {/* The parts wrap as units on a narrow row instead of being cut. */}
        <View style={row.parts}>
          {parts.map((part, index) => (
            <Text key={index} style={row.part} numberOfLines={1}>
              {index < parts.length - 1 ? s.partLead(part) : part}
            </Text>
          ))}
        </View>
      </View>
      <View style={row.points}>
        <Text style={row.pointsValue} testID={`table-points-${standing.team.id}`}>
          {standing.points}
        </Text>
        <Text style={row.unit}>{unit}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  list: { gap: spacing.sm },
  explain: { paddingHorizontal: spacing.xs },
});

/** Width of the rank column (wider with the dyslexia font). */
const RANK_WIDTH = 28;
const RANK_WIDTH_WIDE_FONT = 36;

const useRowStyles = makeStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + spacing.lg,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.8, transform: [{ scale: PRESS_SCALE }] },
  rank: {
    ...typography.displayM,
    width: theme.dyslexiaFont ? RANK_WIDTH_WIDE_FONT : RANK_WIDTH,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    color: theme.colors.textMuted,
  },
  text: { flex: 1, minWidth: 0, gap: spacing.xxs },
  name: { ...typography.body, fontWeight: '700', color: theme.colors.text },
  parts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xs, rowGap: spacing.xxs },
  part: { ...typography.caption, fontVariant: ['tabular-nums'], color: theme.colors.textMuted },
  points: { alignItems: 'flex-end' },
  pointsValue: { ...typography.displayL, fontVariant: ['tabular-nums'], color: theme.colors.text },
  unit: { ...typography.eyebrow, color: theme.colors.textMuted },
}));
