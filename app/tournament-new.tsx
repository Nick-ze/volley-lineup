import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { NotFound, Screen, ScreenTitle, useGoBack } from '@/components';
import { TournamentForm } from '@/features/hostedTournament/TournamentForm';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore, useHostedTournament } from '@/store';

/**
 * `/tournament-new?tournamentId=` — create (or edit) a hosted tournament. Modal (v12). Creating
 * opens the new tournament (on its Teams tab, to enter the teams); editing goes back.
 */
export default function TournamentFormScreen() {
  const t = useT();
  const router = useRouter();
  const { tournamentId } = useLocalSearchParams<{ tournamentId?: string }>();
  const profile = useAppStore(selectCurrentProfile);
  const tournament = useHostedTournament(tournamentId);
  const goBack = useGoBack(tournamentId ? `/tournament/${tournamentId}` : '/tournaments');
  const s = t.tournament;

  if (!profile) return <Redirect href="/" />;
  // A tournament of another profile is not edited here.
  if (tournamentId && (!tournament || tournament.profileId !== profile.id))
    return (
      <NotFound
        message={s.form.notFound}
        onBack={() => router.dismissTo('/tournaments')}
        backLabel={s.form.back}
      />
    );

  return (
    <Screen>
      <ScreenTitle title={tournament ? s.nav.editTournament : s.nav.newTournament} />
      <TournamentForm
        key={tournament?.id ?? 'new'}
        profileId={profile.id}
        tournament={tournament}
        onCancel={goBack}
        onSubmit={(value) => {
          const store = useAppStore.getState();
          if (tournament) {
            store.updateHostedTournament(tournament.id, value);
            goBack();
            return;
          }
          const created = store.addHostedTournament({ profileId: profile.id, ...value });
          router.replace(`/tournament/${created.id}`);
        }}
      />
    </Screen>
  );
}
