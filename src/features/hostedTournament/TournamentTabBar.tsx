import { View } from 'react-native';

import { ChoiceChip } from '@/components';
import { useT } from '@/i18n';
import { makeStyles, spacing } from '@/theme';

import { TOURNAMENT_TABS, type TournamentTab } from './tournamentTabs';

/** The tournament screen's tabs as chips (like a season's Matches · Opponents · Stats). */
export function TournamentTabBar({
  tab,
  onTab,
}: {
  tab: TournamentTab;
  onTab: (tab: TournamentTab) => void;
}) {
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.screen;
  return (
    <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={s.tabs}>
      {TOURNAMENT_TABS.map((key) => (
        <ChoiceChip
          key={key}
          role="tab"
          label={s[key]}
          selected={tab === key}
          onPress={() => onTab(key)}
          style={styles.tab}
          testID={`tournament-tab-${key}`}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: { flex: 1, paddingHorizontal: spacing.xs },
}));
