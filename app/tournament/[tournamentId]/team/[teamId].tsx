import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  appHeaderOnly,
  EmptyState,
  HeaderTitle,
  NotFound,
  Screen,
  useFormStyles,
} from '@/components';
import { standings, teamMatches } from '@/domain/hostedTournament';
import type { HostedTournament } from '@/domain/types';
import { MatchScoreRow } from '@/features/hostedTournament/MatchScoreRow';
import { matchHref, matchKey } from '@/features/hostedTournament/matchRoute';
import { TeamNumbers } from '@/features/hostedTournament/TeamNumbers';
import { TeamPlayers } from '@/features/hostedTournament/TeamPlayers';
import { matchLabel } from '@/features/hostedTournament/tournamentText';
import { useTournamentPlan } from '@/features/hostedTournament/useTournamentPlan';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import {
  selectCurrentProfile,
  useAppStore,
  useHostedResults,
  useHostedTeams,
  useHostedTournament,
} from '@/store';
import { spacing } from '@/theme';

/**
 * `/tournament/[tournamentId]/team/[teamId]` — one team of a hosted tournament (v12): its rank
 * and numbers as a band of large numbers, then its matches in plan order as scoreboard rows —
 * how it played against each of the others. Tapping a match opens its result. v12.2: below them
 * the team's optional players (shown by number or by name).
 */
export default function TournamentTeamScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ tournamentId: string; teamId: string }>();
  const profile = useAppStore(selectCurrentProfile);
  const tournament = useHostedTournament(params.tournamentId);

  if (!profile) return <Redirect href="/" />;
  if (!tournament || tournament.profileId !== profile.id)
    return (
      <NotFound
        message={t.tournament.form.notFound}
        onBack={() => router.dismissTo('/tournaments')}
        backLabel={t.tournament.form.back}
      />
    );
  return <TeamMatches tournament={tournament} teamId={params.teamId} />;
}

function TeamMatches({ tournament, teamId }: { tournament: HostedTournament; teamId: string }) {
  const t = useT();
  const router = useRouter();
  const formStyles = useFormStyles();
  const s = t.tournament;
  const teams = useHostedTeams(tournament.id);
  const results = useHostedResults(tournament.id);
  const plan = useTournamentPlan(tournament);
  const { id, plan: planKind, setsPerMatch, matchEnd } = tournament;
  const standing = useMemo(
    () =>
      standings({ id, plan: planKind, setsPerMatch, matchEnd }, teams, results).find(
        (x) => x.team.id === teamId,
      ),
    [id, planKind, setsPerMatch, matchEnd, teams, results, teamId],
  );
  const matches = useMemo(() => teamMatches(teamId, plan), [teamId, plan]);
  useTourPage(standing ? 'tournamentTeam' : null);

  if (!standing)
    return (
      <NotFound
        message={s.team.notFound}
        onBack={() => router.dismissTo(`/tournament/${tournament.id}?tab=table`)}
        backLabel={s.team.back}
      />
    );

  return (
    <Screen testID="tournament-team-screen">
      <TeamTitle name={standing.team.name} />
      <TeamNumbers standing={standing} settings={tournament} />
      {matches.length === 0 ? <EmptyState>{s.team.empty}</EmptyState> : null}
      <View style={styles.list} testID="team-matches">
        {matches.map(({ match }) => (
          <View key={matchKey(plan.kind, match)} style={styles.match}>
            <Text style={formStyles.eyebrow}>{matchLabel(t, plan.kind, match)}</Text>
            <MatchScoreRow
              match={match}
              onPress={() => router.push(matchHref(tournament.id, plan.kind, match))}
              testID={`team-match-${matchKey(plan.kind, match)}`}
            />
          </View>
        ))}
      </View>
      <TeamPlayers team={standing.team} />
    </Screen>
  );
}

/** The team's name is the screen's title (kept while the name is the same). */
function TeamTitle({ name }: { name: string }) {
  const options = useMemo(
    () => ({
      title: name,
      headerTitle: appHeaderOnly(() => (
        <HeaderTitle testID="hosted-team-title">{name}</HeaderTitle>
      )),
    }),
    [name],
  );
  return <Stack.Screen options={options} />;
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  match: { gap: spacing.xs },
});
