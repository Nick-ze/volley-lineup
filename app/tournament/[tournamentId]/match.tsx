import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import {
  appHeaderOnly,
  ConfirmDialog,
  HeaderTitle,
  NotFound,
  Screen,
  useConfirm,
  useGoBack,
} from '@/components';
import { ResultForm } from '@/features/hostedTournament/ResultForm';
import { formatText, matchLabel } from '@/features/hostedTournament/tournamentText';
import { useTournamentPlan } from '@/features/hostedTournament/useTournamentPlan';
import type { HostedTournament } from '@/domain/types';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore, useHostedTournament } from '@/store';

/**
 * `/tournament/[tournamentId]/match?a=&b=` — the result of one match of a hosted tournament
 * (v12): enter, change or delete it, set by set. `a` and `b` are the two teams' ids, in either
 * order; the pair is shown as on the Matches tab (the team added earlier first). v12.1: a match
 * the coach added is opened with `?m=<its id>`; there "Delete match" removes the match.
 */
export default function TournamentMatchScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{
    tournamentId: string;
    a?: string;
    b?: string;
    m?: string;
  }>();
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
  return <MatchResult tournament={tournament} a={params.a} b={params.b} m={params.m} />;
}

function MatchResult({
  tournament,
  a,
  b,
  m,
}: {
  tournament: HostedTournament;
  a?: string;
  b?: string;
  /** v12.1, own matches: the match's id (a pair can meet more than once). */
  m?: string;
}) {
  const t = useT();
  const router = useRouter();
  const s = t.tournament;
  const plan = useTournamentPlan(tournament);
  const goBack = useGoBack(`/tournament/${tournament.id}?tab=matches`);
  const { ask, dialogProps } = useConfirm();
  const manual = plan.kind === 'manual';
  // Own matches are found by their id; a round robin's by its two teams, in either order.
  const match = plan.rounds
    .flatMap((r) => r.matches)
    .find((x) =>
      manual
        ? x.result?.id === m
        : (x.teamA.id === a && x.teamB.id === b) || (x.teamA.id === b && x.teamB.id === a),
    );

  useTourPage(match ? 'tournamentResult' : null);

  if (!match)
    return (
      <NotFound
        message={s.result.notFound}
        onBack={() => router.dismissTo(`/tournament/${tournament.id}?tab=matches`)}
        backLabel={s.team.back}
      />
    );

  const { teamA, teamB, result } = match;
  const store = () => useAppStore.getState();
  // Round robin: delete the pair's result. Own matches: delete the match itself.
  const onDelete =
    manual && result
      ? () =>
          ask(s.result.confirmDeleteMatch(teamA.name, teamB.name), () => {
            store().deleteHostedMatch(result.id);
            goBack();
          })
      : result
        ? () =>
            ask(s.result.confirmDelete(teamA.name, teamB.name), () => {
              store().deleteHostedResult(tournament.id, teamA.id, teamB.id);
              goBack();
            })
        : undefined;
  return (
    <Screen testID="result-screen">
      <ResultHeader
        subtitle={s.result.subtitle(
          tournament.name,
          matchLabel(t, plan.kind, match),
          formatText(t, tournament),
        )}
      />
      <ResultForm
        // A result saved or deleted elsewhere starts the form afresh.
        key={result?.id ?? 'new'}
        teamA={teamA.name}
        teamB={teamB.name}
        settings={tournament}
        initial={match.sets}
        allowEmpty={manual}
        deleteLabel={manual ? s.result.deleteMatch : undefined}
        onCancel={goBack}
        onSave={(sets) => {
          if (manual && result) store().setHostedMatchSets(result.id, sets);
          else store().setHostedResult(tournament.id, teamA.id, teamB.id, sets);
          goBack();
        }}
        onDelete={onDelete}
      />
      <ConfirmDialog {...dialogProps} />
    </Screen>
  );
}

/** "Result" with the tournament, round and format as the quiet second line. */
function ResultHeader({ subtitle }: { subtitle: string }) {
  const t = useT();
  const title = t.tournament.result.title;
  const options = useMemo(
    () => ({
      title,
      headerTitle: appHeaderOnly(() => <HeaderTitle subtitle={subtitle}>{title}</HeaderTitle>),
    }),
    [title, subtitle],
  );
  return <Stack.Screen options={options} />;
}
