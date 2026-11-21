import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { Screen } from '@/components';
import { parseSetNumber } from '@/domain/lineupEditing';
import { liveSetNumber } from '@/domain/matchFlow';
import type { SetNumber } from '@/domain/types';
import { LiveMatch } from '@/features/live/LiveMatch';
import { LivePerformance } from '@/features/live/LivePerformance';
import { LiveViewToggle, type LiveView } from '@/features/live/LiveViewToggle';
import { useCorrectSetParam } from '@/features/rotation/useCorrectSetParam';
import { useMatch } from '@/store';

/**
 * Live match mode for `?set=N`; without (or with an invalid) `?set` it opens the current set.
 * v6.1: a Performance / Live button in the header; Performance shows every player's overview and detail.
 */
export default function LiveScreen() {
  const { matchId, set } = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  const match = useMatch(matchId);
  const [view, setView] = useState<LiveView>('live');
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
      {match && (
        <Stack.Screen
          options={{ headerRight: () => <LiveViewToggle value={view} onChange={setView} /> }}
        />
      )}
      {match && view === 'performance' ? (
        <LivePerformance match={match} setNumber={setNumber} />
      ) : (
        /* Keyed by set: switching sets drops a half-finished substitution. */
        <LiveMatch
          key={setNumber}
          matchId={matchId}
          setNumber={setNumber}
          onSelectSet={selectSet}
          onEditLineup={editLineup}
          onBackToMatch={backToMatch}
        />
      )}
    </Screen>
  );
}
