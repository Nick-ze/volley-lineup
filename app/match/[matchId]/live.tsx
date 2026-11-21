import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { Screen } from '@/components';
import { parseSetNumber } from '@/domain/lineupEditing';
import { liveSetNumber } from '@/domain/matchFlow';
import type { SetNumber } from '@/domain/types';
import { LiveMatch } from '@/features/live/LiveMatch';
import { useCorrectSetParam } from '@/features/rotation/useCorrectSetParam';
import { useMatch } from '@/store';

/** Live match mode for `?set=N`; without (or with an invalid) `?set` it opens the current set. */
export default function LiveScreen() {
  const { matchId, set } = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  const match = useMatch(matchId);
  const setNumber = match ? liveSetNumber(match, set) : parseSetNumber(set);
  const selectSet = useCallback((s: SetNumber) => router.setParams({ set: String(s) }), [router]);
  const editLineup = useCallback(
    (s: SetNumber) =>
      router.push({ pathname: '/match/[matchId]', params: { matchId, set: String(s) } }),
    [router, matchId],
  );
  const backToMatch = useCallback(
    () => router.navigate({ pathname: '/match/[matchId]', params: { matchId } }),
    [router, matchId],
  );
  useCorrectSetParam(set, setNumber, selectSet);
  return (
    <Screen>
      {/* Keyed by set: switching sets drops a half-finished substitution. */}
      <LiveMatch
        key={setNumber}
        matchId={matchId}
        setNumber={setNumber}
        onSelectSet={selectSet}
        onEditLineup={editLineup}
        onBackToMatch={backToMatch}
      />
    </Screen>
  );
}
