import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { parseSetNumber } from '@/domain/lineupEditing';
import { LineupBuilder } from '@/features/lineup/LineupBuilder';
import { SetTabs } from '@/features/lineup/SetTabs';
import { useLineupEditor } from '@/features/lineup/useLineupEditor';
import { PrintButton } from '@/features/print/PrintButton';
import { useCorrectSetParam } from '@/features/rotation/useCorrectSetParam';
import { useT } from '@/i18n';
import { colors, maxContentWidth, spacing, touchTarget, typography } from '@/theme';

/**
 * Match screen: set tabs 1–5 + lineup builder for `?set=N`, links to rotation and starters.
 * Switching tabs only changes the URL; a set is stored once it is first edited.
 */
export default function MatchScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ matchId: string; set?: string }>();
  const router = useRouter();
  const matchId = String(params.matchId);
  const setNumber = parseSetNumber(params.set);
  const editor = useLineupEditor(matchId, setNumber);
  const { match } = editor;
  useCorrectSetParam(params.set, match ? setNumber : undefined, (n) =>
    router.setParams({ set: String(n) }),
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
      <Stack.Screen options={{ title: t.lineup.title(match.opponent) }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          <SetTabs
            selected={setNumber}
            existing={match.sets.map((s) => s.setNumber)}
            onSelect={(n) => router.setParams({ set: String(n) })}
          />
          <View style={styles.links}>
            <Button
              label={t.lineup.rotation}
              accessibilityLabel={t.lineup.rotationLabel}
              variant="secondary"
              compact
              style={styles.link}
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
              style={styles.link}
              onPress={() =>
                router.push({ pathname: '/match/[matchId]/starters', params: { matchId } })
              }
              testID="open-starters"
            />
            <PrintButton matchId={matchId} style={styles.link} />
            <Button
              label={t.live.open}
              accessibilityLabel={t.live.openLabel}
              variant="secondary"
              compact
              style={styles.link}
              onPress={() =>
                router.push({
                  pathname: '/match/[matchId]/live',
                  params: { matchId, set: String(setNumber) },
                })
              }
              testID="open-live"
            />
          </View>
          <LineupBuilder editor={editor} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  inner: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Four links: one row on wide screens, two rows of two on phones.
  link: { flexGrow: 1, flexBasis: 0, minWidth: touchTarget * 3 },
  notFound: { ...typography.body, color: colors.textMuted, padding: spacing.lg },
});
