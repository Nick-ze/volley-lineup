import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { firstSetForNewMatch } from '@/domain/presets';
import { MatchForm } from '@/features/roster/components/MatchForm';
import { NotFound } from '@/features/roster/components/NotFound';
import { useGoBack } from '@/features/roster/hooks/useGoBack';
import { useT } from '@/i18n';
import { selectPlayersForTeam, useAppStore, useTeam } from '@/store';

/** `/team/[teamId]/match-new` — create a match, then open it. Modal. */
export default function NewMatchScreen() {
  const t = useT();
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const team = useTeam(teamId);
  const goBack = useGoBack(`/team/${teamId}?tab=matches`);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;

  return (
    <Screen>
      <MatchForm
        onCancel={goBack}
        onSubmit={(value) => {
          const store = useAppStore.getState();
          // Set 1 starts with the team's starters when they are complete.
          const players = selectPlayersForTeam(store, team.id);
          const first = firstSetForNewMatch(store.presets, team.id, players);
          const match = store.addMatch({ teamId: team.id, ...value, sets: [first] });
          router.replace(`/match/${match.id}`);
        }}
      />
    </Screen>
  );
}
