import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Button, EmptyState, ReadOnlyNote, useListStyles } from '@/components';
import type { Match, Season } from '@/domain/types';
import { useT } from '@/i18n';
import { useMatchesForTeam, useSeasonsForTeam, useTeamAccess } from '@/store';
import { makeStyles, spacing } from '@/theme';
import { useIsWide } from '@/lib/useIsWide';

import { SeasonCard } from './SeasonCard';

export interface SeasonsTabProps {
  teamId: string;
  onNewSeason: () => void;
  onOpenSeason: (seasonId: string) => void;
}

/**
 * v7.0: the team's Matches tab — one box per season / tournament (newest first). Matches live
 * inside a season; tapping a box opens the season screen. v10: no New season for view-only
 * members.
 */
export function SeasonsTab({ teamId, onNewSeason, onOpenSeason }: SeasonsTabProps) {
  const listStyles = useListStyles();
  const styles = useStyles();
  const t = useT();
  const seasons = useSeasonsForTeam(teamId);
  const matches = useMatchesForTeam(teamId);
  const wide = useIsWide();
  const access = useTeamAccess(teamId);
  const s = t.seasons.list;
  return (
    <>
      {access.canEdit ? (
        <View style={[listStyles.headerRow, listStyles.tabHeader]}>
          <View />
          <Button label={s.newSeason} onPress={onNewSeason} compact />
        </View>
      ) : (
        <View style={listStyles.tabHeader}>
          <ReadOnlyNote block={access.block} />
        </View>
      )}
      {seasons.length === 0 ? <EmptyState testID="seasons-empty">{s.empty}</EmptyState> : null}
      <View style={[styles.grid, wide && styles.gridWide]} testID="season-list">
        {seasons.map((season) => (
          <View key={season.id} style={wide ? styles.cellWide : null}>
            <SeasonBox season={season} teamMatches={matches} onOpenSeason={onOpenSeason} />
          </View>
        ))}
      </View>
    </>
  );
}

/**
 * v8.3: one season's box with its matches. The list keeps its array while those matches are
 * unchanged (`useShallow`), so the box's overview isn't recomputed when another season changes.
 */
function SeasonBox({
  season,
  teamMatches,
  onOpenSeason,
}: {
  season: Season;
  teamMatches: readonly Match[];
  onOpenSeason: (seasonId: string) => void;
}) {
  const ofSeason = useShallow((all: readonly Match[]) =>
    all.filter((m) => m.seasonId === season.id),
  );
  return (
    <SeasonCard
      season={season}
      matches={ofSeason(teamMatches)}
      onPress={() => onOpenSeason(season.id)}
    />
  );
}

const useStyles = makeStyles(() => ({
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  // Two boxes per row on wide screens (the gap is shared between them).
  cellWide: { flexBasis: '48%', flexGrow: 1, maxWidth: '50%' },
}));
