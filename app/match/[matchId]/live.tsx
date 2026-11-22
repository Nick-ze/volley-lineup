import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Screen, SwipeTabs } from '@/components';
import { parseSetNumber } from '@/domain/lineupEditing';
import { liveSetNumber } from '@/domain/matchFlow';
import type { SetNumber } from '@/domain/types';
import { LiveMatch } from '@/features/live/LiveMatch';
import { LivePerformance } from '@/features/live/LivePerformance';
import { LIVE_VIEWS, LiveViewToggle, type LiveView } from '@/features/live/LiveViewToggle';
import { useCorrectSetParam } from '@/features/rotation/useCorrectSetParam';
import { useMatch } from '@/store';
import { spacing } from '@/theme';

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
  // v8: LiveMatch is remounted per set, so the set shown before is kept here for its slide.
  const [shown, setShown] = useState({ set: setNumber, previous: null as SetNumber | null });
  if (shown.set !== setNumber) setShown({ set: setNumber, previous: shown.set ?? null });
  // Back from Performance the court only slides in with the view, not as another set.
  const changeView = (next: LiveView) => {
    setView(next);
    setShown((s) => (s.previous === null ? s : { ...s, previous: null }));
  };
  return (
    <Screen>
      {match && (
        <Stack.Screen
          options={{ headerRight: () => <LiveViewToggle value={view} onChange={changeView} /> }}
        />
      )}
      {/* v8: Live ↔ Performance slides; a sideways swipe switches between them. */}
      <SwipeTabs
        tabs={LIVE_VIEWS}
        value={view}
        onChange={changeView}
        testID="live-view-swipe"
        contentStyle={styles.content}
      >
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
            previousSet={shown.previous}
          />
        )}
      </SwipeTabs>
    </Screen>
  );
}

// The screen's gap between its parts, also inside the slide.
const styles = StyleSheet.create({ content: { gap: spacing.lg } });
