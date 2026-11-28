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
import { formatText } from '@/features/hostedTournament/tournamentText';
import { useTournamentPlan } from '@/features/hostedTournament/useTournamentPlan';
import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore, useHostedTournament } from '@/store';

/**
 * `/tournament/[tournamentId]/match?a=&b=` — the result of one match of a hosted tournament
 * (v12): enter, change or delete it, set by set. `a` and `b` are the two teams' ids, in either
 * order; the pair is shown as on the Matches tab (the team added earlier first).
 */
export default function TournamentMatchScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ tournamentId: string; a?: string; b?: string }>();
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
  return <MatchResult tournament={tournament} a={params.a} b={params.b} />;
}

function MatchResult({
  tournament,
  a,
  b,
}: {
  tournament: HostedTournament;
  a?: string;
  b?: string;
}) {
  const t = useT();
  const router = useRouter();
  const s = t.tournament;
  const plan = useTournamentPlan(tournament);
  const goBack = useGoBack(`/tournament/${tournament.id}?tab=matches`);
  const { ask, dialogProps } = useConfirm();
  const match = plan.rounds
    .flatMap((r) => r.matches)
    .find((m) => (m.teamA.id === a && m.teamB.id === b) || (m.teamA.id === b && m.teamB.id === a));

  if (!match)
    return (
      <NotFound
        message={s.result.notFound}
        onBack={() => router.dismissTo(`/tournament/${tournament.id}?tab=matches`)}
        backLabel={s.team.back}
      />
    );

  const { teamA, teamB } = match;
  return (
    <Screen testID="result-screen">
      <ResultHeader
        subtitle={s.result.subtitle(tournament.name, match.round, formatText(t, tournament))}
      />
      <ResultForm
        // A result saved or deleted elsewhere starts the form afresh.
        key={match.result?.id ?? 'new'}
        teamA={teamA.name}
        teamB={teamB.name}
        settings={tournament}
        initial={match.sets}
        onCancel={goBack}
        onSave={(sets) => {
          useAppStore.getState().setHostedResult(tournament.id, teamA.id, teamB.id, sets);
          goBack();
        }}
        onDelete={
          match.result
            ? () =>
                ask(s.result.confirmDelete(teamA.name, teamB.name), () => {
                  useAppStore.getState().deleteHostedResult(tournament.id, teamA.id, teamB.id);
                  goBack();
                })
            : undefined
        }
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
