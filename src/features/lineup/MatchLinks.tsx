import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components';
import { playedSetNumbers } from '@/domain/stats';
import type { Match, SetNumber } from '@/domain/types';
import { PrintButton } from '@/features/print/PrintButton';
import { useT } from '@/i18n';
import { useIsWide } from '@/lib/useIsWide';
import { makeStyles, spacing, touchTarget } from '@/theme';

export interface MatchLinksProps {
  match: Match;
  /** The set shown in the builder (rotation and performance open on it). */
  setNumber: SetNumber;
}

/** The match screen's links: rotation, starters, print, live, stats and performance. */
export function MatchLinks({ match, setNumber }: MatchLinksProps) {
  const styles = useStyles();
  const t = useT();
  const wide = useIsWide();
  const router = useRouter();
  const matchId = match.id;

  const link = [styles.link, wide ? styles.linkWide : styles.linkPhone];
  // Print / PDF wraps its button in a View: the size goes on the wrapper, the padding on the
  // button, so it lines up with the other links.
  const printBox = [styles.link, wide ? styles.linkWide : styles.linkPhoneBox];
  const printButton = wide ? undefined : styles.linkPhonePadding;

  return (
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
        onPress={() => router.push({ pathname: '/match/[matchId]/starters', params: { matchId } })}
        testID="open-starters"
      />
      <PrintButton matchId={matchId} style={printBox} buttonStyle={printButton} />
      <Button
        label={t.live.open}
        accessibilityLabel={t.live.openLabel}
        variant="secondary"
        compact
        style={link}
        onPress={() => router.push({ pathname: '/match/[matchId]/live', params: { matchId } })}
        testID="open-live"
      />
      <Button
        label={t.stats.open}
        accessibilityLabel={t.stats.openLabel}
        variant="secondary"
        compact
        style={link}
        onPress={() => router.push({ pathname: '/match/[matchId]/stats', params: { matchId } })}
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
  );
}

const useStyles = makeStyles((theme) => ({
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
}));
