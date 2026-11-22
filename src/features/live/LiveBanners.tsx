import { Text, View } from 'react-native';

import { MAX_SUBS_PER_SET, type LiveState, type LiveWarning } from '@/domain/liveSet';
import type { Player } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

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

/** Set point (yellow) and substitution rule warnings (red outline). */
export function LiveBanners({ state, opponent, playersById }: LiveBannersProps) {
  const styles = useStyles();
  const t = useT();
  // A won set is shown by the set-won panel instead of a banner.
  const { setPoint: side, warnings } = state;
  return (
    <>
      {side ? (
        <View style={styles.setPoint} accessibilityRole="alert" testID="set-banner">
          <Text style={styles.setPointText}>{t.live.setPoint(side === 'us', opponent)}</Text>
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

const useStyles = makeStyles((theme) => ({
  setPoint: {
    backgroundColor: theme.colors.highlight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  setPointText: { ...typography.subheading, color: theme.colors.onHighlight, textAlign: 'center' },
  warnings: {
    borderWidth: 2,
    borderColor: theme.colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: theme.colors.surface,
  },
  warningsTitle: { ...typography.label, color: theme.colors.error },
  warning: { ...typography.body, color: theme.colors.text },
}));
