import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appHeaderOnly, HeaderTitle, SlideTransition } from '@/components';
import { parseSetNumber } from '@/domain/lineupEditing';
import { LineupBuilder } from '@/features/lineup/LineupBuilder';
import { MatchHeaderButtons } from '@/features/lineup/MatchHeaderButtons';
import { MatchHeaderLines } from '@/features/lineup/MatchHeaderLines';
import { MatchLinks } from '@/features/lineup/MatchLinks';
import { MatchReadOnlyNote } from '@/features/live/MatchReadOnlyNote';
import { PresetApply } from '@/features/lineup/PresetApply';
import { SetTabs } from '@/features/lineup/SetTabs';
import { usePrintMenu } from '@/features/print/usePrintMenu';
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
  // v10: a granted Take over is for scoring: open live, which keeps the hold (useMatchHold).
  const openLive = useCallback(
    () => router.push({ pathname: '/match/[matchId]/live', params: { matchId } }),
    [router, matchId],
  );
  // v11: the header carries the season and result lines under the title, and Live + Print / PDF
  // at the right (kept while nothing they show changes).
  const print = usePrintMenu(matchId);
  const { open: openPrint, disabled: printDisabled } = print;
  const hasMatch = match !== undefined;
  const options = useMemo(
    () => ({
      title,
      headerTitle: appHeaderOnly(() => (
        <HeaderTitle subtitle={<MatchHeaderLines matchId={matchId} />}>{title ?? ''}</HeaderTitle>
      )),
      headerRight: appHeaderOnly(() =>
        hasMatch ? (
          <MatchHeaderButtons onLive={openLive} onPrint={openPrint} printDisabled={printDisabled} />
        ) : null,
      ),
    }),
    [title, matchId, hasMatch, openLive, openPrint, printDisabled],
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
          <MatchLinks match={match} setNumber={setNumber} />
          {print.dialog}
          {print.failed ? (
            <Text accessibilityRole="alert" style={styles.printError} testID="print-error">
              {t.print.failed}
            </Text>
          ) : null}
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
  printError: { ...typography.body, color: theme.colors.error },
}));
