import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, useFormStyles } from '@/components';
import type { PlanMatch } from '@/domain/hostedTournament';
import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { AddMatchPanel } from './AddMatchPanel';
import { matchKey } from './matchRoute';
import { MatchScoreRow } from './MatchScoreRow';
import { useTournamentPlan } from './useTournamentPlan';

export interface TournamentMatchesProps {
  tournament: HostedTournament;
  /** Tapping a match opens its result. */
  onOpenMatch: (match: PlanMatch) => void;
}

/**
 * The plan: how many matches are played, then the rounds, each under a small label, with a
 * round's resting team as one grey line. The plan is worked out from the teams; nothing of it
 * is stored. v12.1: in a tournament with own matches the coach adds them here ("Add match", the
 * tab's one orange action) and they are listed in the order added.
 */
export function TournamentMatches({ tournament, onOpenMatch }: TournamentMatchesProps) {
  const formStyles = useFormStyles();
  const t = useT();
  const s = t.tournament.matches;
  const plan = useTournamentPlan(tournament);
  const manual = plan.kind === 'manual';
  const matches = plan.rounds.flatMap((round) => round.matches);

  // Own matches (v12.1): the coach adds them; one list in the order added, no rounds.
  if (manual) {
    if (plan.teams.length < 2) {
      return <EmptyState testID="plan-empty">{s.emptyManualTeams}</EmptyState>;
    }
    return (
      <View style={styles.wrap}>
        <AddMatchPanel tournament={tournament} teams={plan.teams} />
        {matches.length === 0 ? (
          <EmptyState testID="plan-empty">{s.emptyManual}</EmptyState>
        ) : (
          <>
            <Text style={formStyles.hint} testID="plan-played">
              {s.played(plan.played, plan.total)}
            </Text>
            <View style={styles.round} testID="plan-matches">
              {matches.map((match) => (
                <View key={matchKey(plan.kind, match)} style={styles.numbered}>
                  <Text style={formStyles.eyebrow}>{s.match(match.number)}</Text>
                  <MatchScoreRow
                    match={match}
                    onPress={() => onOpenMatch(match)}
                    testID={`plan-match-${matchKey(plan.kind, match)}`}
                  />
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    );
  }

  if (plan.rounds.length === 0) return <EmptyState testID="plan-empty">{s.empty}</EmptyState>;

  return (
    <View style={styles.wrap}>
      <Text style={formStyles.hint} testID="plan-played">
        {s.played(plan.played, plan.total)}
      </Text>
      {plan.rounds.map((round) => (
        <View key={round.round} style={styles.round} testID={`plan-round-${round.round}`}>
          <Text style={formStyles.eyebrow} accessibilityRole="header">
            {s.round(round.round)}
          </Text>
          {round.matches.map((match) => (
            <MatchScoreRow
              key={matchKey(plan.kind, match)}
              match={match}
              onPress={() => onOpenMatch(match)}
              testID={`plan-match-${matchKey(plan.kind, match)}`}
            />
          ))}
          {round.resting ? (
            <Text style={[formStyles.hint, styles.resting]} testID={`plan-resting-${round.round}`}>
              {s.resting(round.resting.name)}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  round: { gap: spacing.sm },
  resting: { paddingHorizontal: spacing.xs },
  numbered: { gap: spacing.xs },
});
