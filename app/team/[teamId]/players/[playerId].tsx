import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { PlayerDetail } from '@/features/playerDetail/PlayerDetail';
import { NotFound } from '@/features/roster/components/NotFound';
import { useGoBack } from '@/features/roster/hooks/useGoBack';
import { useT } from '@/i18n';
import { usePlayer, useTeam } from '@/store';

/** `/team/[teamId]/players/[playerId]` — player detail: photo, stats, description (v6). */
export default function PlayerDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { teamId, playerId } = useLocalSearchParams<{ teamId: string; playerId: string }>();
  const team = useTeam(teamId);
  const player = usePlayer(playerId);
  const goBack = useGoBack(`/team/${teamId}`);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;
  // Like the editor: a player of another team is not shown under this team.
  if (!player || player.teamId !== team.id)
    return (
      <NotFound
        message={t.roster.player.notFound}
        onBack={goBack}
        backLabel={t.roster.backToTeam}
      />
    );

  return (
    <Screen testID="player-detail">
      <Stack.Screen options={{ title: `${player.firstName} ${player.lastName}` }} />
      <PlayerDetail
        player={player}
        onEdit={() => router.push(`/team/${team.id}/player?playerId=${player.id}`)}
        onOpenMatch={(matchId) =>
          router.push(`/match/${matchId}/performance?set=all&player=${player.id}`)
        }
      />
    </Screen>
  );
}
