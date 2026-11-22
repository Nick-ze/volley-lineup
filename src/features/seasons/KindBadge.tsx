import { Text } from 'react-native';

import type { SeasonKind } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

/** "Season" / "Tournament" as a small pill (tournaments in blue, seasons in orange). */
export function KindBadge({ kind }: { kind: SeasonKind }) {
  const styles = useStyles();
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

const useStyles = makeStyles((theme) => ({
  badge: {
    ...typography.caption,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.round,
    overflow: 'hidden',
  },
  season: { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary },
  tournament: { backgroundColor: theme.colors.secondary, color: theme.colors.onSecondary },
}));
