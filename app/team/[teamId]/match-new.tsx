import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { MatchForm } from '@/features/roster/components/MatchForm';
import { NotFound } from '@/features/roster/components/NotFound';
import { useGoBack } from '@/features/roster/hooks/useGoBack';
import { t } from '@/i18n/en';
import { useAppStore, useTeam } from '@/store';

/** `/team/[teamId]/match-new` — create a match, then open it. Modal. */
export default function NewMatchScreen() {
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
          const match = useAppStore.getState().addMatch({ teamId: team.id, ...value });
          router.replace(`/match/${match.id}`);
        }}
      />
    </Screen>
  );
}
