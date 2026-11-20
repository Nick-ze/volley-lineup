import { Stack, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components';
import { NotFound } from '@/features/roster/components/NotFound';
import { PlayerForm } from '@/features/roster/components/PlayerForm';
import { useGoBack } from '@/features/roster/hooks/useGoBack';
import { t } from '@/i18n/en';
import { useAppStore, usePlayer, useTeam } from '@/store';

/** `/team/[teamId]/player?playerId=` — add (no id) or edit a player. Modal. */
export default function PlayerEditorScreen() {
  const { teamId, playerId } = useLocalSearchParams<{ teamId: string; playerId?: string }>();
  const team = useTeam(teamId);
  const player = usePlayer(playerId);
  const goBack = useGoBack(`/team/${teamId}`);

  if (!team) return <NotFound message={t.roster.teamNotFound} onBack={goBack} />;
  if (playerId && !player) return <NotFound message={t.roster.player.notFound} onBack={goBack} />;

  return (
    <Screen>
      <Stack.Screen
        options={{ title: player ? t.roster.player.editTitle : t.roster.player.addTitle }}
      />
      <PlayerForm
        key={player?.id ?? 'new'}
        teamId={team.id}
        player={player}
        onDone={goBack}
        onDelete={
          player
            ? () => {
                goBack();
                useAppStore.getState().deletePlayer(player.id);
              }
            : undefined
        }
      />
    </Screen>
  );
}
