import { useLocalSearchParams, useRouter } from 'expo-router';

import { NotFound, Screen } from '@/components';
import { MatchPerformance } from '@/features/performance/MatchPerformance';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useMatch } from '@/store';

/**
 * `/match/[matchId]/performance?set=N|all&player=ID` — per-player performance of a set or the
 * whole match, and one player's detail (v6).
 */
export default function PerformanceScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId: string; set?: string; player?: string }>();
  const match = useMatch(String(params.matchId));
  useTourPage(match ? 'performance' : null);

  if (!match)
    return <NotFound message={t.performance.notFound} onBack={() => router.dismissTo('/teams')} />;

  return (
    <Screen>
      <MatchPerformance
        match={match}
        setParam={params.set}
        playerParam={params.player}
        onParams={(next) => router.setParams(next)}
        onOpenPlayer={(next) =>
          router.push({
            pathname: '/match/[matchId]/performance',
            params: { matchId: match.id, ...next },
          })
        }
      />
    </Screen>
  );
}
