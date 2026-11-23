import { StyleSheet, View } from 'react-native';

import { ChoiceChip } from '@/components';
import type { Season } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

export interface SeasonFilterProps {
  /** The team's seasons, newest first. */
  seasons: readonly Season[];
  /** null = all seasons. */
  value: string | null;
  onChange: (seasonId: string | null) => void;
}

/** v7.0: All seasons · <season> · … (chips that wrap). Tournaments say so on the chip. */
export function SeasonFilter({ seasons, value, onChange }: SeasonFilterProps) {
  const t = useT();
  const f = t.stats.seasonFilter;
  return (
    <View style={styles.row} accessibilityRole="tablist" accessibilityLabel={f.label}>
      <ChoiceChip
        role="tab"
        label={f.all}
        accessibilityLabel={f.allLabel}
        selected={value === null}
        onPress={() => onChange(null)}
        testID="stats-season-all"
      />
      {seasons.map((s) => {
        const kind = t.roster.seasonKind[s.kind];
        const label = s.kind === 'tournament' ? t.roster.seasonLine(s.name, kind) : s.name;
        return (
          <ChoiceChip
            key={s.id}
            role="tab"
            label={label}
            accessibilityLabel={
              s.kind === 'tournament' ? label : t.roster.seasonLabel(s.name, kind)
            }
            selected={value === s.id}
            onPress={() => onChange(s.id)}
            testID={`stats-season-${s.id}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
