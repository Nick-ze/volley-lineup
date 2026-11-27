import { Text, View } from 'react-native';

import { Button, ChoiceChip } from '@/components';
import type { Season } from '@/domain/types';
import { useT } from '@/i18n';
import { useCanEdit } from '@/store';
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

/**
 * The season's kind, dates / place, Edit (v10: not for view-only members), and the Matches ·
 * Opponents · Stats tabs. v11: the season's name is the screen's title (in the header).
 */
export function SeasonHeader({ season, tab, onTab, onEdit }: SeasonHeaderProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.seasons.screen;
  const whenWhere = seasonWhenWhere(t, season);
  const canEdit = useCanEdit(season.teamId);
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={styles.titleBox}>
          <View style={styles.metaRow}>
            <KindBadge kind={season.kind} />
            {whenWhere !== '' ? <Text style={styles.meta}>{whenWhere}</Text> : null}
          </View>
        </View>
        {canEdit ? (
          <Button
            label={s.edit}
            accessibilityLabel={s.editLabel(season.name)}
            variant="secondary"
            compact
            onPress={onEdit}
          />
        ) : null}
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
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleBox: { flex: 1, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  meta: { ...typography.label, color: theme.colors.textMuted },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: { flex: 1, paddingHorizontal: spacing.xs },
}));
