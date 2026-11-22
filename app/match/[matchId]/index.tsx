import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { parseSetNumber } from '@/domain/lineupEditing';
import { playedSetNumbers } from '@/domain/stats';
import { LineupBuilder } from '@/features/lineup/LineupBuilder';
import { MatchResultLine } from '@/features/live/MatchResultLine';
import { MatchSeasonLine } from '@/features/matchForm/MatchSeasonLine';
import { PresetApply } from '@/features/lineup/PresetApply';
import { SetTabs } from '@/features/lineup/SetTabs';
import { useLineupEditor } from '@/features/lineup/useLineupEditor';
import { PrintButton } from '@/features/print/PrintButton';
import { useCorrectSetParam } from '@/features/rotation/useCorrectSetParam';
import { useT } from '@/i18n';
import { useIsWide } from '@/lib/useIsWide';
import { makeStyles, maxContentWidth, spacing, touchTarget, typography } from '@/theme';

/**
 * Match screen: set tabs 1–5 + lineup builder for `?set=N`, links to rotation and starters.
 * Switching tabs only changes the URL; a set is stored once it is first edited.
 */
export default function MatchScreen() {
  const styles = useStyles();
  const t = useT();
  const wide = useIsWide();
  const params = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  const matchId = String(params.matchId);
  const setNumber = parseSetNumber(params.set);
  const editor = useLineupEditor(matchId, setNumber);
  const { match } = editor;
  useCorrectSetParam(params.set, match ? setNumber : undefined, (n) =>
    router.setParams({ set: String(n) }),
  );

  const link = [styles.link, wide ? styles.linkWide : styles.linkPhone];
  // Print / PDF wraps its button in a View: the size goes on the wrapper, the padding on the
  // button, so it lines up with the other links.
  const printBox = [styles.link, wide ? styles.linkWide : styles.linkPhoneBox];
  const printButton = wide ? undefined : styles.linkPhonePadding;

  if (!match) {
    return (
      <View style={styles.safe}>
        <Text style={styles.notFound}>{t.lineup.matchNotFound}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: t.lineup.title(match.opponent) }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          <SetTabs
            selected={setNumber}
            existing={match.sets.map((s) => s.setNumber)}
            onSelect={(n) => router.setParams({ set: String(n) })}
          />
          <MatchResultLine match={match} />
          <MatchSeasonLine match={match} />
          <View style={styles.links}>
            <Button
              label={t.lineup.rotation}
              accessibilityLabel={t.lineup.rotationLabel}
              variant="secondary"
              compact
              style={link}
              onPress={() =>
                router.push({
                  pathname: '/match/[matchId]/rotation',
                  params: { matchId, set: String(setNumber) },
                })
              }
              testID="open-rotation"
            />
            <Button
              label={t.lineup.starters}
              accessibilityLabel={t.lineup.startersLabel}
              variant="secondary"
              compact
              style={link}
              onPress={() =>
                router.push({ pathname: '/match/[matchId]/starters', params: { matchId } })
              }
              testID="open-starters"
            />
            <PrintButton matchId={matchId} style={printBox} buttonStyle={printButton} />
            <Button
              label={t.live.open}
              accessibilityLabel={t.live.openLabel}
              variant="secondary"
              compact
              style={link}
              onPress={() =>
                router.push({ pathname: '/match/[matchId]/live', params: { matchId } })
              }
              testID="open-live"
            />
            <Button
              label={t.stats.open}
              accessibilityLabel={t.stats.openLabel}
              variant="secondary"
              compact
              style={link}
              onPress={() =>
                router.push({ pathname: '/match/[matchId]/stats', params: { matchId } })
              }
              testID="open-stats"
            />
            <Button
              label={t.performance.open}
              accessibilityLabel={t.performance.openLabel}
              variant="secondary"
              compact
              style={link}
              onPress={() =>
                router.push({
                  pathname: '/match/[matchId]/performance',
                  // The selected set when it has been played, otherwise the whole match.
                  params: {
                    matchId,
                    set: playedSetNumbers(match).includes(setNumber) ? String(setNumber) : 'all',
                  },
                })
              }
              testID="open-performance"
            />
          </View>
          <LineupBuilder
            editor={editor}
            previous={editor.previous}
            actions={
              <PresetApply key={`apply-${setNumber}`} editor={editor} teamId={match.teamId} />
            }
          />
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
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Six links: one row on wide screens, two rows of three on phones (v8: three rows of two with
  // the wide dyslexia font, so "Aufstellungen" fits its button).
  link: { flexGrow: 1, minWidth: touchTarget },
  linkWide: { flexBasis: 0 },
  linkPhone: {
    flexBasis: theme.dyslexiaFont ? '40%' : '30%',
    paddingHorizontal: spacing.sm,
  },
  linkPhoneBox: { flexBasis: theme.dyslexiaFont ? '40%' : '30%' },
  linkPhonePadding: { paddingHorizontal: spacing.sm },
  notFound: { ...typography.body, color: theme.colors.textMuted, padding: spacing.lg },
}));
