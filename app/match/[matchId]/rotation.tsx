import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { Screen } from '@/components';
import { RotationViewer } from '@/features/rotation';
import { useTourPage } from '@/features/tour';
import { useMatch } from '@/store';

export default function RotationScreen() {
  const { matchId, set } = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  const match = useMatch(matchId);
  useTourPage(match ? 'rotation' : null);
  const selectSet = useCallback((s: number) => router.setParams({ set: String(s) }), [router]);
  return (
    <Screen>
      <RotationViewer matchId={matchId} setParam={set} onSelectSet={selectSet} />
    </Screen>
  );
}
