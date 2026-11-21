import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { NotFound } from '@/features/roster/components/NotFound';
import { MatchStats } from '@/features/stats/MatchStats';
import { useT } from '@/i18n';
import { useMatch } from '@/store';

/** `/match/[matchId]/stats` — rotation and player statistics of one match, with a set filter. */
export default function MatchStatsScreen() {
  const t = useT();
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const match = useMatch(matchId);

  if (!match)
    return <NotFound message={t.stats.matchNotFound} onBack={() => router.dismissTo('/teams')} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: t.nav.matchStats }} />
      <MatchStats match={match} />
    </Screen>
  );
}
