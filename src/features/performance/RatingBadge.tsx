import { StyleSheet, Text, View } from 'react-native';

import type { Rating } from '@/domain/performance';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

const tone = {
  positive: colors.secondaryText,
  even: colors.textMuted,
  negative: colors.error,
  none: colors.textMuted,
} as const;

/** The one-glance rating: a symbol and a word (never colour alone, DECISIONS #152). */
export function RatingBadge({ rating, testID }: { rating: Rating | null; testID?: string }) {
  const t = useT();
  const key = rating ?? 'none';
  const color = tone[key];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.text, { color }]} numberOfLines={1} testID={testID}>
        {`${t.performance.ratingSymbol[key]} ${t.performance.rating[key]}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  text: { ...typography.label },
});
