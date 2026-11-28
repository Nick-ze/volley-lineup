import { Text, View } from 'react-native';

import { IconButton, ListRow, useListStyles } from '@/components';
import { formatOptionalDate } from '@/domain/dates';
import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing } from '@/theme';

import { TrophyMark } from './TrophyMark';
import { useTournamentPlan } from './useTournamentPlan';

export interface TournamentRowProps {
  tournament: HostedTournament;
  onOpen: () => void;
  onEdit: () => void;
  /** Gets the numbers for the confirmation. */
  onDelete: (teams: number, results: number) => void;
}

/** Size of the trophy mark in the row (as a team's picture on the Teams tab). */
const ROW_MARK = 52;

/**
 * One hosted tournament of the Tournaments tab: the trophy mark, the name, "6 teams · 9 of 15
 * played" and the date; Edit and Delete as icon buttons in the row.
 */
export function TournamentRow({ tournament, onOpen, onEdit, onDelete }: TournamentRowProps) {
  const styles = useListStyles();
  const own = useStyles();
  const t = useT();
  const s = t.tournament.list;
  const plan = useTournamentPlan(tournament);
  const teams = s.teamCount(plan.teams.length);
  const played = t.tournament.matches.played(plan.played, plan.total);
  const summary = s.summary(teams, played);
  const date = formatOptionalDate(tournament.date);
  const results = plan.rounds.flatMap((r) => r.matches).filter((m) => m.result).length;
  return (
    <ListRow
      title={tournament.name}
      subtitle={
        <View style={own.lines}>
          {/* Two parts that share a line when they fit; on a narrow row each takes its own. */}
          <View style={own.parts} testID={`tournament-${tournament.id}-summary`}>
            <Text style={styles.subtitle} numberOfLines={1}>
              {s.summaryLead(teams)}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {played}
            </Text>
          </View>
          {date !== '' ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {date}
            </Text>
          ) : null}
        </View>
      }
      leading={<TrophyMark size={ROW_MARK} />}
      testID={`tournament-${tournament.id}`}
      onPress={onOpen}
      accessibilityLabel={s.open(tournament.name, summary)}
      actions={
        <>
          <IconButton
            icon="pencil"
            accessibilityLabel={s.editLabel(tournament.name)}
            onPress={onEdit}
            testID={`tournament-${tournament.id}-edit`}
          />
          <IconButton
            icon="trash-outline"
            accessibilityLabel={s.deleteLabel(tournament.name)}
            onPress={() => onDelete(plan.teams.length, results)}
            testID={`tournament-${tournament.id}-delete`}
          />
        </>
      }
    />
  );
}

const useStyles = makeStyles(() => ({
  lines: { gap: spacing.xxs },
  parts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xs, rowGap: spacing.xxs },
}));
