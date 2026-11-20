import { ScrollView, StyleSheet, View } from 'react-native';

import type { SetNumber } from '@/domain/types';
import { t } from '@/i18n/en';
import { useIsWide } from '@/lib/useIsWide';
import { spacing } from '@/theme';

import { Message } from './RotationViewer';
import { SetStartersCard } from './SetStartersCard';
import { useMatchLineups } from './useMatchLineups';

export interface StartersOverviewProps {
  matchId: string | undefined;
  onOpenSet: (set: SetNumber) => void;
}

/** Every set's starting six side by side: a wrapping grid on wide screens, a swipeable row on phones. */
export function StartersOverview({ matchId, onOpenSet }: StartersOverviewProps) {
  const isWide = useIsWide();
  const { match, sets, playersById } = useMatchLineups(matchId);
  if (!match) return <Message text={t.rotation.matchNotFound} />;
  if (sets.length === 0) return <Message text={t.rotation.noSets} />;

  const cards = sets.map((set) => (
    <SetStartersCard key={set.setNumber} set={set} playersById={playersById} onOpen={onOpenSet} />
  ));

  if (isWide) return <View style={styles.grid}>{cards}</View>;
  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.row}
      testID="starters-scroll"
      showsHorizontalScrollIndicator
    >
      {cards}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'center' },
  row: { gap: spacing.md, paddingBottom: spacing.sm },
});
