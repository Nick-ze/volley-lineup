import { Text, View } from 'react-native';

import { Button } from '@/components';
import {
  attackErrorRate,
  errorRate,
  errorsPerAction,
  rating,
  serveErrorRate,
  type PlayerPerformance,
} from '@/domain/performance';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { DetailLine } from './DetailLine';
import { breakdownText, percentText, performanceRef } from './format';
import { PlayerAvatar } from './PlayerAvatar';
import { RatingBadge } from './RatingBadge';

export interface PlayerPerformanceDetailProps {
  player: Player;
  performance: PlayerPerformance;
  /** The team's rallies in the shown set(s). */
  totalRallies: number;
  onBack: () => void;
}

/** One player's numbers for the chosen set / all sets (docs/PLAN.md §25.4). */
export function PlayerPerformanceDetail({
  player,
  performance: p,
  totalRallies,
  onBack,
}: PlayerPerformanceDetailProps) {
  const styles = useStyles();
  const t = useT();
  const pt = t.performance;
  const ref = performanceRef(t, player);
  const count = (n: number) => String(n);
  return (
    <View style={styles.wrap} testID="perf-detail">
      <Button
        label={pt.back}
        accessibilityLabel={pt.backLabel}
        variant="secondary"
        compact
        onPress={onBack}
        style={styles.back}
        testID="perf-back"
      />
      <View style={styles.head}>
        <PlayerAvatar player={player} size={56} />
        <Text style={styles.name} accessibilityRole="header" testID="perf-detail-name">
          {ref}
        </Text>
        <RatingBadge rating={rating(p)} testID="perf-detail-rating" />
      </View>
      <View>
        <DetailLine
          label={pt.onCourt}
          value={pt.ralliesOf(p.rallies, totalRallies)}
          testID="perf-on-court"
        />
        <DetailLine
          label={pt.wonLost}
          value={pt.wonLostValue(p.won, p.lost)}
          testID="perf-won-lost"
        />
        <DetailLine
          label={pt.errorRate}
          value={
            p.rallies === 0
              ? pt.none
              : pt.errorRateValue(percentText(t, errorRate(p)), p.errors, p.rallies)
          }
          hint={pt.errorRateHint}
          testID="perf-error-rate"
        />
        <DetailLine
          label={pt.errorsPerAction}
          value={percentText(t, errorsPerAction(p))}
          hint={pt.errorsPerActionHint}
          testID="perf-errors-per-action"
        />
        <DetailLine
          label={pt.serveErrorRate}
          value={percentText(t, serveErrorRate(p))}
          hint={pt.serveErrorRateHint}
          testID="perf-serve-error-rate"
        />
        <DetailLine
          label={pt.attackErrorRate}
          value={percentText(t, attackErrorRate(p))}
          hint={pt.attackErrorRateHint}
          testID="perf-attack-error-rate"
        />
        <DetailLine label={pt.errorsByType} value={breakdownText(t, p)} testID="perf-breakdown" />
        <DetailLine label={pt.kills} value={count(p.kills)} testID="perf-kills" />
        <DetailLine label={pt.aces} value={count(p.aces)} testID="perf-aces" />
        <DetailLine label={pt.blocks} value={count(p.blocks)} testID="perf-blocks" />
        <DetailLine label={pt.serves} value={count(p.serves)} testID="perf-serves" />
        <DetailLine
          label={pt.servePoints}
          value={count(p.servePoints)}
          testID="perf-serve-points"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.md },
  back: { alignSelf: 'flex-start' },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  name: { ...typography.subheading, color: theme.colors.text, flexShrink: 1 },
}));
