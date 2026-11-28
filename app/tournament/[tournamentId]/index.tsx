import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { appHeaderOnly, Button, HeaderTitle, NotFound, Screen } from '@/components';
import type { HostedTournament } from '@/domain/types';
import { TournamentMeta } from '@/features/hostedTournament/TournamentMeta';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore, useHostedTournament } from '@/store';

/**
 * `/tournament/[tournamentId]` — one hosted tournament (v12): its name as the title, Edit in
 * the header, and the quiet line with date, place and format.
 */
export default function TournamentScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ tournamentId: string }>();
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

  return (
    <Screen testID="tournament-screen">
      <TournamentHeader
        tournament={tournament}
        onEdit={() => router.push(`/tournament-new?tournamentId=${tournament.id}`)}
      />
      <TournamentMeta tournament={tournament} />
    </Screen>
  );
}

/** The header options, kept while the name is the same (no `setOptions` per render). */
function TournamentHeader({
  tournament,
  onEdit,
}: {
  tournament: HostedTournament;
  onEdit: () => void;
}) {
  const t = useT();
  const s = t.tournament.screen;
  const { name } = tournament;
  const options = useMemo(
    () => ({
      title: name,
      headerTitle: appHeaderOnly(() => <HeaderTitle testID="tournament-name">{name}</HeaderTitle>),
      headerRight: appHeaderOnly(() => (
        <Button
          label={s.edit}
          accessibilityLabel={s.editLabel(name)}
          variant="secondary"
          compact
          onPress={onEdit}
          testID="tournament-edit"
        />
      )),
    }),
    [name, s, onEdit],
  );
  return <Stack.Screen options={options} />;
}
