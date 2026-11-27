import { Text, View } from 'react-native';

import type { Rating } from '@/domain/performance';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography, useTheme, type ThemeColors } from '@/theme';

const tone = (colors: ThemeColors) =>
  ({
    positive: { text: colors.secondaryText, fill: colors.secondarySoft },
    even: { text: colors.textMuted, fill: colors.surfaceRaised },
    negative: { text: colors.error, fill: colors.surfaceRaised },
    none: { text: colors.textMuted, fill: colors.surfaceRaised },
  }) as const;

/** The one-glance rating: a symbol and a word (never colour alone, DECISIONS #152). */
export function RatingBadge({ rating, testID }: { rating: Rating | null; testID?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const t = useT();
  const key = rating ?? 'none';
  const { text, fill } = tone(colors)[key];
  return (
    <View style={[styles.badge, { backgroundColor: fill }]}>
      <Text style={[styles.text, { color: text }]} numberOfLines={1} testID={testID}>
        {`${t.performance.ratingSymbol[key]} ${t.performance.rating[key]}`}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // v11: a soft chip (tone, no outline).
  badge: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  text: { ...typography.label },
}));
