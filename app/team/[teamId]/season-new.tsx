import { useLocalSearchParams, useRouter } from 'expo-router';

import { ConfirmDialog, NotFound, Screen, ScreenTitle, useConfirm, useGoBack } from '@/components';
import { SeasonForm } from '@/features/seasons/SeasonForm';
import { ViewOnlyScreen } from '@/features/sync/ViewOnlyScreen';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useAppStore, useCanEdit, useMatchesForSeason, useSeason, useTeam } from '@/store';

/**
 * `/team/[teamId]/season-new?seasonId=` — create (or edit) a season / tournament. Modal (v7.0).
 * Creating opens the new season; deleting asks first and goes back to the team. v10: view-only
 * members get the reason instead of the form.
 */
export default function SeasonFormScreen() {
  const t = useT();
  const router = useRouter();
  const { teamId, seasonId } = useLocalSearchParams<{ teamId: string; seasonId?: string }>();
  const team = useTeam(teamId);
  const season = useSeason(seasonId);
  const matches = useMatchesForSeason(seasonId);
  const goBack = useGoBack(
    seasonId ? `/team/${teamId}/season/${seasonId}` : `/team/${teamId}?tab=matches`,
  );
  const { ask, dialogProps } = useConfirm();
  const s = t.seasons.form;
  const canEdit = useCanEdit(teamId);
  useTourPage(team && canEdit && (!seasonId || season?.teamId === team.id) ? 'seasonForm' : null);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;
  // A season of another team must not be edited here.
  if (seasonId && (!season || season.teamId !== team.id))
    return (
      <NotFound
        message={s.notFound}
        onBack={() => router.dismissTo(`/team/${team.id}?tab=matches`)}
        backLabel={s.backToTeam}
      />
    );

  const teamTab = `/team/${team.id}?tab=matches` as const;
  const title = season ? s.editTitle : s.newTitle;
  if (!canEdit) return <ViewOnlyScreen title={title} backLabel={s.backToTeam} onBack={goBack} />;
  return (
    <Screen>
      <ScreenTitle title={title} />
      <SeasonForm
        key={season?.id ?? 'new'}
        teamId={team.id}
        season={season}
        onCancel={goBack}
        onSubmit={(value) => {
          const store = useAppStore.getState();
          if (season) {
            store.updateSeason(season.id, value);
            goBack();
            return;
          }
          const created = store.addSeason({ teamId: team.id, ...value });
          router.replace(`/team/${team.id}/season/${created.id}`);
        }}
        onDelete={
          season
            ? () =>
                ask(s.confirmDelete(season.name, matches.length), () => {
                  // Leave the season's screens first, then delete (they would show "not found").
                  router.dismissTo(teamTab);
                  useAppStore.getState().deleteSeason(season.id);
                })
            : undefined
        }
      />
      <ConfirmDialog {...dialogProps} />
    </Screen>
  );
}
