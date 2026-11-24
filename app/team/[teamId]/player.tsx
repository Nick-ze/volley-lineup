import { useLocalSearchParams, useRouter } from 'expo-router';

import { NotFound, Screen, ScreenTitle, useGoBack } from '@/components';
import { isPlayerInPlayedSet } from '@/domain/playerUsage';
import { PlayerForm } from '@/features/roster/components/PlayerForm';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useAppStore, usePlayer, useTeam } from '@/store';

/** `/team/[teamId]/player?playerId=` — add (no id) or edit a player. Modal. */
export default function PlayerEditorScreen() {
  const t = useT();
  const { teamId, playerId } = useLocalSearchParams<{ teamId: string; playerId?: string }>();
  const team = useTeam(teamId);
  const player = usePlayer(playerId);
  const deleteBlocked = useAppStore((s) => !!playerId && isPlayerInPlayedSet(s.matches, playerId));
  const goBack = useGoBack(`/team/${teamId}`);
  const router = useRouter();
  useTourPage(team ? 'playerForm' : null);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;
  // A player id from another team must not be edited here (it would bypass per-team checks).
  if (playerId && (!player || player.teamId !== team.id))
    return (
      <NotFound
        message={t.roster.player.notFound}
        onBack={goBack}
        backLabel={t.roster.backToTeam}
      />
    );

  return (
    <Screen>
      <ScreenTitle title={player ? t.roster.player.editTitle : t.roster.player.addTitle} />
      <PlayerForm
        key={player?.id ?? 'new'}
        teamId={team.id}
        player={player}
        onDone={goBack}
        deleteBlocked={deleteBlocked}
        onDelete={
          player
            ? () => {
                // Not goBack(): the previous screen may be this player's detail screen.
                router.dismissTo(`/team/${team.id}`);
                useAppStore.getState().deletePlayer(player.id);
              }
            : undefined
        }
      />
    </Screen>
  );
}
