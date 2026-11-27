import { Text } from 'react-native';

import type { SeasonKind } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

/**
 * "Season" / "Tournament" as a small capital label (v11: coloured text instead of a filled pill;
 * tournaments in blue, seasons in orange).
 */
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
  badge: { ...typography.eyebrow, alignSelf: 'flex-start' },
  season: { color: theme.colors.primaryText },
  tournament: { color: theme.colors.secondaryText },
}));
