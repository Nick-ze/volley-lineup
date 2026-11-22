import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { listStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { useMatchesForTeam, useSeasonsForTeam } from '@/store';
import { spacing } from '@/theme';
import { useIsWide } from '@/lib/useIsWide';

import { SeasonCard } from './SeasonCard';

export interface SeasonsTabProps {
  teamId: string;
  onNewSeason: () => void;
  onOpenSeason: (seasonId: string) => void;
}

/**
 * v7.0: the team's Matches tab — one box per season / tournament (newest first). Matches live
 * inside a season; tapping a box opens the season screen.
 */
export function SeasonsTab({ teamId, onNewSeason, onOpenSeason }: SeasonsTabProps) {
  const t = useT();
  const seasons = useSeasonsForTeam(teamId);
  const matches = useMatchesForTeam(teamId);
  const wide = useIsWide();
  const s = t.seasons.list;
  return (
    <>
      <View style={listStyles.headerRow}>
        <View />
        <Button label={s.newSeason} onPress={onNewSeason} compact />
      </View>
      {seasons.length === 0 ? (
        <Text style={listStyles.empty} testID="seasons-empty">
          {s.empty}
        </Text>
      ) : null}
      <View style={[styles.grid, wide && styles.gridWide]} testID="season-list">
        {seasons.map((season) => (
          <View key={season.id} style={wide ? styles.cellWide : null}>
            <SeasonCard
              season={season}
              matches={matches.filter((m) => m.seasonId === season.id)}
              onPress={() => onOpenSeason(season.id)}
            />
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  // Two boxes per row on wide screens (the gap is shared between them).
  cellWide: { flexBasis: '48%', flexGrow: 1, maxWidth: '50%' },
});
