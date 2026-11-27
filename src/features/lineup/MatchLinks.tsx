import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { LinkTile } from '@/components';
import { playedSetNumbers } from '@/domain/stats';
import type { Match, SetNumber } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing } from '@/theme';

export interface MatchLinksProps {
  match: Match;
  /** The set shown in the builder (rotation and performance open on it). */
  setNumber: SetNumber;
}

/**
 * The match screen's links to its other views: rotation, starters, stats and performance. v11:
 * one row of small tiles (DECISIONS #340); Live and Print / PDF are in the header
 * (`MatchHeaderButtons`), so the court starts higher.
 */
export function MatchLinks({ match, setNumber }: MatchLinksProps) {
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const matchId = match.id;

  return (
    <View style={styles.links}>
      <LinkTile
        label={t.lineup.rotation}
        accessibilityLabel={t.lineup.rotationLabel}
        icon="sync-outline"
        style={styles.link}
        onPress={() =>
          router.push({
            pathname: '/match/[matchId]/rotation',
            params: { matchId, set: String(setNumber) },
          })
        }
        testID="open-rotation"
      />
      <LinkTile
        label={t.lineup.starters}
        accessibilityLabel={t.lineup.startersLabel}
        icon="grid-outline"
        style={styles.link}
        onPress={() => router.push({ pathname: '/match/[matchId]/starters', params: { matchId } })}
        testID="open-starters"
      />
      <LinkTile
        label={t.stats.open}
        accessibilityLabel={t.stats.openLabel}
        icon="stats-chart-outline"
        style={styles.link}
        onPress={() => router.push({ pathname: '/match/[matchId]/stats', params: { matchId } })}
        testID="open-stats"
      />
      <LinkTile
        label={t.performance.open}
        accessibilityLabel={t.performance.openLabel}
        icon="pulse-outline"
        style={styles.link}
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
  // Four tiles in one row; two rows of two with the wide dyslexia font, so "Aufstellungen" fits.
  link: theme.dyslexiaFont ? { flexBasis: '40%' } : {},
}));
