import { Text } from 'react-native';

import type { Match } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

import { matchResultLabel } from './matchResult';

/** A small "3:1 won" / "2:1 · in progress" line for the match header (nothing before play). */
export function MatchResultLine({ match }: { match: Pick<Match, 'sets'> }) {
  const styles = useStyles();
  const t = useT();
  const label = matchResultLabel(t, match);
  if (!label) return null;
  return (
    <Text
      style={styles.line}
      numberOfLines={1}
      accessibilityLabel={t.match.resultLabel(label)}
      testID="match-result"
    >
      {label}
    </Text>
  );
}

const useStyles = makeStyles((theme) => ({
  line: { ...typography.label, color: theme.colors.textMuted, flexShrink: 1, maxWidth: '100%' },
}));
