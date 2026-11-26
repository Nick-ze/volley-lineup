import { useLocalSearchParams, useRouter } from 'expo-router';

import { NotFound, Screen, ScreenTitle, useGoBack } from '@/components';
import { isPlayerInPlayedSet, removePlayerEverywhere } from '@/domain/playerUsage';
import { PlayerForm } from '@/features/roster/components/PlayerForm';
import { ViewOnlyScreen } from '@/features/sync/ViewOnlyScreen';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import {
  canEditTeamNow,
  heldMatchesNow,
  useAppStore,
  useCanEdit,
  useHeldMatches,
  useMatchesForTeam,
  usePlayer,
  useTeam,
} from '@/store';

/**
 * `/team/[teamId]/player?playerId=` — add (no id) or edit a player. Modal. v10: view-only members
 * get the reason instead of the form (no Save, Delete or Captain).
 */
export default function PlayerEditorScreen() {
  const t = useT();
  const { teamId, playerId } = useLocalSearchParams<{ teamId: string; playerId?: string }>();
  const team = useTeam(teamId);
  const player = usePlayer(playerId);
  const deleteBlocked = useAppStore((s) => !!playerId && isPlayerInPlayedSet(s.matches, playerId));
  // v10 audit M15: deleting a player takes them out of every lineup, also of a match another
  // device is scoring live right now — not while that device holds the match.
  const lineups = useMatchesForTeam(teamId).filter(
    (m) => !!playerId && m.sets.some((set) => removePlayerEverywhere(set, playerId) !== set),
  );
  const holder = [...useHeldMatches(lineups.map((m) => m.id)).values()][0];
  const goBack = useGoBack(`/team/${teamId}`);
  const router = useRouter();
  const canEdit = useCanEdit(teamId);
  useTourPage(team && canEdit ? 'playerForm' : null);

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

  const title = player ? t.roster.player.editTitle : t.roster.player.addTitle;
  if (!canEdit)
    return <ViewOnlyScreen title={title} backLabel={t.roster.backToTeam} onBack={goBack} />;

  return (
    <Screen>
      <ScreenTitle title={title} />
      <PlayerForm
        key={player?.id ?? 'new'}
        teamId={team.id}
        player={player}
        onDone={goBack}
        deleteBlocked={deleteBlocked || holder !== undefined}
        deleteBlockedText={
          holder && !deleteBlocked ? t.sync.readOnly.heldNoDelete(holder.holderName) : undefined
        }
        onDelete={
          player
            ? () => {
                // Asked again at the moment of the answer (v10 audit L18, M15), with the
                // lineups as they are then: the scorer may have put the player in meanwhile.
                const now = useAppStore
                  .getState()
                  .matches.filter(
                    (m) =>
                      m.teamId === team.id &&
                      m.sets.some((set) => removePlayerEverywhere(set, player.id) !== set),
                  );
                const held = heldMatchesNow(now.map((m) => m.id));
                if (!canEditTeamNow(team.id) || held.length > 0) return;
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
