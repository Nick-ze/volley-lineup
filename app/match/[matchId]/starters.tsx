import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen, ScreenTitle } from '@/components';
import { StartersOverview } from '@/features/rotation';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useMatch } from '@/store';

export default function StartersScreen() {
  const t = useT();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  useTourPage(useMatch(matchId) ? 'matchStarters' : null);
  return (
    <Screen>
      <ScreenTitle title={t.rotation.startersTitle} />
      <StartersOverview
        matchId={matchId}
        onOpenSet={(set) =>
          router.push({
            pathname: '/match/[matchId]/rotation',
            params: { matchId, set: String(set) },
          })
        }
      />
    </Screen>
  );
}
