import { StyleSheet, Text, View } from 'react-native';

import { MAX_SUBS_PER_SET, type LiveState, type LiveWarning } from '@/domain/liveSet';
import type { Player } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

import { playerRef } from './format';

export interface LiveBannersProps {
  state: LiveState;
  opponent: string;
  playersById: Map<string, Player>;
}

function warningText(t: Strings, w: LiveWarning, playersById: Map<string, Player>): string {
  const out = playerRef(t, playersById, w.outPlayerId);
  const inn = playerRef(t, playersById, w.inPlayerId);
  switch (w.code) {
    case 'SUB_LIMIT':
      return t.live.warnSubLimit(out, inn, MAX_SUBS_PER_SET);
    case 'REENTRY_RULE':
      return t.live.warnReentry(out, inn);
    case 'INVALID_SUB':
      return t.live.warnInvalid(out, inn);
  }
}

/** Set point / set won (yellow) and substitution rule warnings (red outline). */
export function LiveBanners({ state, opponent, playersById }: LiveBannersProps) {
  const t = useT();
  const { setPoint, setWinner, warnings } = state;
  const side = setWinner ?? setPoint;
  return (
    <>
      {side ? (
        <View style={styles.setPoint} accessibilityRole="alert" testID="set-banner">
          <Text style={styles.setPointText}>
            {setWinner
              ? t.live.setWon(side === 'us', opponent)
              : t.live.setPoint(side === 'us', opponent)}
          </Text>
        </View>
      ) : null}
      {warnings.length > 0 ? (
        <View style={styles.warnings} accessibilityRole="alert" testID="warnings-banner">
          <Text style={styles.warningsTitle}>{t.live.warningsTitle}</Text>
          {warnings.map((w) => (
            <Text key={`${w.eventIndex}-${w.code}`} style={styles.warning}>
              {warningText(t, w, playersById)}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  setPoint: {
    backgroundColor: colors.highlight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  setPointText: { ...typography.subheading, color: colors.onHighlight, textAlign: 'center' },
  warnings: {
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  warningsTitle: { ...typography.label, color: colors.error },
  warning: { ...typography.body, color: colors.text },
});
