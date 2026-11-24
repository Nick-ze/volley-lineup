import { useLocalSearchParams, useRouter } from 'expo-router';

import { NotFound, Screen, ScreenTitle } from '@/components';
import { MatchStats } from '@/features/stats/MatchStats';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useMatch } from '@/store';

/** `/match/[matchId]/stats` — rotation and player statistics of one match, with a set filter. */
export default function MatchStatsScreen() {
  const t = useT();
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const match = useMatch(matchId);
  useTourPage(match ? 'matchStats' : null);

  if (!match)
    return <NotFound message={t.stats.matchNotFound} onBack={() => router.dismissTo('/teams')} />;

  return (
    <Screen>
      <ScreenTitle title={t.nav.matchStats} />
      <MatchStats match={match} />
    </Screen>
  );
}
