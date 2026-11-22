import { StyleSheet, Text } from 'react-native';

import type { SeasonKind } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

/** "Season" / "Tournament" as a small pill (tournaments in blue, seasons in orange). */
export function KindBadge({ kind }: { kind: SeasonKind }) {
  const t = useT();
  return (
    <Text
      style={[styles.badge, kind === 'tournament' ? styles.tournament : styles.season]}
      testID={`kind-${kind}`}
    >
      {t.seasons.kind[kind]}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...typography.caption,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.round,
    overflow: 'hidden',
  },
  season: { backgroundColor: colors.primary, color: colors.onPrimary },
  tournament: { backgroundColor: colors.secondary, color: colors.onSecondary },
});
