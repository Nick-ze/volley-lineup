import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { Screen } from '@/components';
import { RotationViewer } from '@/features/rotation';

export default function RotationScreen() {
  const { matchId, set } = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  const selectSet = useCallback((s: number) => router.setParams({ set: String(s) }), [router]);
  return (
    <Screen>
      <RotationViewer matchId={matchId} setParam={set} onSelectSet={selectSet} />
    </Screen>
  );
}
