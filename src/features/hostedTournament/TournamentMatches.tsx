import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, useFormStyles } from '@/components';
import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { MatchScoreRow } from './MatchScoreRow';
import { useTournamentPlan } from './useTournamentPlan';

export interface TournamentMatchesProps {
  tournament: HostedTournament;
  /** Tapping a match opens its result. */
  onOpenMatch: (teamAId: string, teamBId: string) => void;
}

/**
 * The plan: how many matches are played, then the rounds, each under a small label, with a
 * round's resting team as one grey line. The plan is worked out from the teams; nothing of it
 * is stored.
 */
export function TournamentMatches({ tournament, onOpenMatch }: TournamentMatchesProps) {
  const formStyles = useFormStyles();
  const t = useT();
  const s = t.tournament.matches;
  const plan = useTournamentPlan(tournament);

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
              key={`${match.teamA.id}|${match.teamB.id}`}
              match={match}
              onPress={() => onOpenMatch(match.teamA.id, match.teamB.id)}
              testID={`plan-match-${match.teamA.id}-${match.teamB.id}`}
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
});
