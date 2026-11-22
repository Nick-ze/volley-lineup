import { Text } from 'react-native';

import type { Match } from '@/domain/types';
import { useT } from '@/i18n';
import { useSeason } from '@/store';
import { makeStyles, typography } from '@/theme';

/** v7.0: "2026/27 · Season" — the season / tournament a match belongs to (match header). */
export function MatchSeasonLine({ match }: { match: Pick<Match, 'seasonId'> }) {
  const styles = useStyles();
  const t = useT();
  const season = useSeason(match.seasonId);
  if (!season) return null;
  return (
    <Text style={styles.line} testID="match-season">
      {t.roster.seasonLine(season.name, t.roster.seasonKind[season.kind])}
    </Text>
  );
}

const useStyles = makeStyles((theme) => ({
  line: { ...typography.label, color: theme.colors.textMuted },
}));
