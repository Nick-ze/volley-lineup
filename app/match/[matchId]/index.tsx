import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlideTransition } from '@/components';
import { parseSetNumber } from '@/domain/lineupEditing';
import { LineupBuilder } from '@/features/lineup/LineupBuilder';
import { MatchLinks } from '@/features/lineup/MatchLinks';
import { MatchReadOnlyNote } from '@/features/live/MatchReadOnlyNote';
import { MatchResultLine } from '@/features/live/MatchResultLine';
import { MatchSeasonLine } from '@/features/matchForm/MatchSeasonLine';
import { PresetApply } from '@/features/lineup/PresetApply';
import { SetTabs } from '@/features/lineup/SetTabs';
import { useTourPage } from '@/features/tour';
import { useLineupEditor } from '@/features/lineup/useLineupEditor';
import { useCorrectSetParam } from '@/features/rotation/useCorrectSetParam';
import { useT } from '@/i18n';
import { makeStyles, maxContentWidth, spacing, typography } from '@/theme';

/**
 * Match screen: set tabs 1–5 + lineup builder for `?set=N`, links to rotation and starters.
 * Switching tabs only changes the URL; a set is stored once it is first edited.
 */
export default function MatchScreen() {
  const styles = useStyles();
  const t = useT();
  const params = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  const matchId = String(params.matchId);
  const setNumber = parseSetNumber(params.set);
  const editor = useLineupEditor(matchId, setNumber);
  const { match } = editor;
  useTourPage(match ? 'builder' : null);
  useCorrectSetParam(params.set, match ? setNumber : undefined, (n) =>
    router.setParams({ set: String(n) }),
  );

  const title = match ? t.lineup.title(match.opponent) : undefined;
  const options = useMemo(() => ({ title }), [title]);
  // v10: a granted Take over is for scoring: open live, which keeps the hold (useMatchHold).
  const openLive = useCallback(
    () => router.push({ pathname: '/match/[matchId]/live', params: { matchId } }),
    [router, matchId],
  );

  if (!match) {
    return (
      <View style={styles.safe}>
        <Text style={styles.notFound}>{t.lineup.matchNotFound}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={options} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          <SetTabs
            selected={setNumber}
            existing={match.sets.map((s) => s.setNumber)}
            onSelect={(n) => router.setParams({ set: String(n) })}
          />
          <MatchResultLine match={match} />
          <MatchSeasonLine match={match} />
          <MatchLinks match={match} setNumber={setNumber} />
          {/* v10: why a view-only member / another device's live scoring has no controls here. */}
          <MatchReadOnlyNote matchId={matchId} onTakenOver={openLive} />
          {/* v8: another set's lineup slides in from the side of its tab (no swipe here: the
              builder's court and bench are drag & drop areas). */}
          <SlideTransition index={setNumber} clip={false}>
            <LineupBuilder
              editor={editor}
              previous={editor.previous}
              actions={
                <PresetApply key={`apply-${setNumber}`} editor={editor} teamId={match.teamId} />
              }
            />
          </SlideTransition>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1 },
  inner: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  notFound: { ...typography.body, color: theme.colors.textMuted, padding: spacing.lg },
}));
