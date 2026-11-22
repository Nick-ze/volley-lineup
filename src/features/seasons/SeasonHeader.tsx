import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { Season } from '@/domain/types';
import { ChoiceChip } from '@/features/roster/components/ChoiceChip';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { KindBadge } from './KindBadge';
import { SEASON_TABS, type SeasonTab } from './seasonTabs';
import { seasonWhenWhere } from './seasonText';

export interface SeasonHeaderProps {
  season: Season;
  tab: SeasonTab;
  onTab: (tab: SeasonTab) => void;
  onEdit: () => void;
}

/** The season's name, kind, dates / place, Edit, and the Matches · Opponents · Stats tabs. */
export function SeasonHeader({ season, tab, onTab, onEdit }: SeasonHeaderProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.seasons.screen;
  const whenWhere = seasonWhenWhere(t, season);
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={styles.titleBox}>
          <Text style={styles.name} accessibilityRole="header" testID="season-name">
            {season.name}
          </Text>
          <View style={styles.metaRow}>
            <KindBadge kind={season.kind} />
            {whenWhere !== '' ? <Text style={styles.meta}>{whenWhere}</Text> : null}
          </View>
        </View>
        <Button
          label={s.edit}
          accessibilityLabel={s.editLabel(season.name)}
          variant="secondary"
          compact
          onPress={onEdit}
        />
      </View>
      <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={s.tabs}>
        {SEASON_TABS.map((key) => (
          <ChoiceChip
            key={key}
            role="tab"
            label={s[key]}
            selected={tab === key}
            onPress={() => onTab(key)}
            style={styles.tab}
            testID={`season-tab-${key}`}
          />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleBox: { flex: 1, gap: spacing.xs },
  name: { ...typography.heading, color: theme.colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  meta: { ...typography.label, color: theme.colors.textMuted },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: { flex: 1, paddingHorizontal: spacing.xs },
}));
