import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { Screen } from '@/components';
import { parseSetNumber } from '@/domain/lineupEditing';
import type { SetNumber } from '@/domain/types';
import { LiveMatch } from '@/features/live/LiveMatch';
import { useCorrectSetParam } from '@/features/rotation/useCorrectSetParam';

/** Live match mode for `?set=N` (default set 1). */
export default function LiveScreen() {
  const { matchId, set } = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  const setNumber = parseSetNumber(set);
  const selectSet = useCallback((s: SetNumber) => router.setParams({ set: String(s) }), [router]);
  useCorrectSetParam(set, setNumber, selectSet);
  return (
    <Screen>
      <LiveMatch matchId={matchId} setNumber={setNumber} onSelectSet={selectSet} />
    </Screen>
  );
}
