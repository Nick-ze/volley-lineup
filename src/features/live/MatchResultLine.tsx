import { StyleSheet, Text } from 'react-native';

import type { Match } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, typography } from '@/theme';

import { matchResultLabel } from './matchResult';

/** A small "3:1 won" / "2:1 · in progress" line for the match header (nothing before play). */
export function MatchResultLine({ match }: { match: Pick<Match, 'sets'> }) {
  const t = useT();
  const label = matchResultLabel(t, match);
  if (!label) return null;
  return (
    <Text style={styles.line} accessibilityLabel={t.match.resultLabel(label)} testID="match-result">
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { ...typography.label, color: colors.textMuted },
});
