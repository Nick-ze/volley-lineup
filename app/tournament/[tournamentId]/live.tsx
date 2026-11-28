import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { appHeaderOnly, HeaderTitle, NotFound, Screen, useGoBack } from '@/components';
import type { HostedTournament } from '@/domain/types';
import { HostedLive } from '@/features/hostedTournament/HostedLive';
import { matchHref } from '@/features/hostedTournament/matchRoute';
import { formatText, matchLabel } from '@/features/hostedTournament/tournamentText';
import { useTournamentPlan } from '@/features/hostedTournament/useTournamentPlan';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore, useHostedTournament } from '@/store';

/**
 * `/tournament/[tournamentId]/live?a=&b=` (a round robin's pair) or `?m=` (a match the coach
 * added) — live scoring of a tournament match (v12.2): only the score, point by point, with
 * optional point details. Opened from the match's result screen.
 */
export default function TournamentLiveScreen() {
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
  return <LiveMatch tournament={tournament} a={params.a} b={params.b} m={params.m} />;
}

function LiveMatch({
  tournament,
  a,
  b,
  m,
}: {
  tournament: HostedTournament;
  a?: string;
  b?: string;
  m?: string;
}) {
  const t = useT();
  const router = useRouter();
  const s = t.tournament;
  const plan = useTournamentPlan(tournament);
  const manual = plan.kind === 'manual';
  const match = plan.rounds
    .flatMap((r) => r.matches)
    .find((x) =>
      manual
        ? x.result?.id === m
        : (x.teamA.id === a && x.teamB.id === b) || (x.teamA.id === b && x.teamB.id === a),
    );
  const goBack = useGoBack(
    match ? matchHref(tournament.id, plan.kind, match) : `/tournament/${tournament.id}?tab=matches`,
  );
  useTourPage(match ? 'tournamentLive' : null);

  if (!match)
    return (
      <NotFound
        message={s.live.notFound}
        onBack={() => router.dismissTo(`/tournament/${tournament.id}?tab=matches`)}
        backLabel={s.team.back}
      />
    );

  return (
    <Screen testID="tournament-live-screen">
      <LiveHeader
        subtitle={s.result.subtitle(
          tournament.name,
          matchLabel(t, plan.kind, match),
          formatText(t, tournament),
        )}
      />
      <HostedLive tournament={tournament} kind={plan.kind} match={match} onDone={goBack} />
    </Screen>
  );
}

/** "Live" with the tournament, round and format as the quiet second line. */
function LiveHeader({ subtitle }: { subtitle: string }) {
  const t = useT();
  const title = t.tournament.live.title;
  const options = useMemo(
    () => ({
      title,
      headerTitle: appHeaderOnly(() => <HeaderTitle subtitle={subtitle}>{title}</HeaderTitle>),
    }),
    [title, subtitle],
  );
  return <Stack.Screen options={options} />;
}
