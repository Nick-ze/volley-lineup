import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import {
  appHeaderOnly,
  HeaderTitle,
  NotFound,
  ReadOnlyNote,
  Screen,
  SwipeTabs,
} from '@/components';
import { seasonTabPage } from '@/domain/tour';
import { SeasonHeader } from '@/features/seasons/SeasonHeader';
import { SeasonMatches } from '@/features/seasons/SeasonMatches';
import { SeasonOpponents } from '@/features/seasons/SeasonOpponents';
import { SeasonStats } from '@/features/seasons/SeasonStats';
import { parseSeasonTab, SEASON_TABS, type SeasonTab } from '@/features/seasons/seasonTabs';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useOpponentsForSeason, useSeason, useTeam, useTeamAccess } from '@/store';

/**
 * `/team/[teamId]/season/[seasonId]?tab=matches|opponents|stats` — one season / tournament: its
 * matches (with search), its opponent teams (record per opponent) and its stats (v7.0). Tapping an
 * opponent shows the Matches tab filtered to it (screen state, not a URL param: upgraded opponent
 * ids contain "%", which the router decodes twice). v10: view-only members see the reason below
 * the header (no Edit, New match, opponent changes).
 */
export default function SeasonScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ teamId: string; seasonId: string; tab?: string }>();
  const team = useTeam(params.teamId);
  const season = useSeason(params.seasonId);
  const opponents = useOpponentsForSeason(season?.id);
  const tab = parseSeasonTab(params.tab);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const opponent = opponents.find((o) => o.id === opponentId);
  const access = useTeamAccess(params.teamId);
  // v9.0: the shown tab's tips (never in the tabs: the pager keeps their neighbours mounted).
  // v10: none for view-only members (the tips point at controls they don't have).
  useTourPage(team && season?.teamId === team.id && access.canEdit ? seasonTabPage(tab) : null);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;
  if (!season || season.teamId !== team.id)
    return (
      <NotFound
        message={t.seasons.form.notFound}
        onBack={() => router.dismissTo(`/team/${team.id}?tab=matches`)}
        backLabel={t.seasons.form.backToTeam}
      />
    );

  const selectTab = (next: SeasonTab) => {
    setOpponentId(null);
    router.setParams({ tab: next });
  };
  const renderTab = (shown: SeasonTab) => {
    switch (shown) {
      case 'matches':
        return (
          <SeasonMatches
            seasonId={season.id}
            opponent={opponent}
            onClearOpponent={() => setOpponentId(null)}
            onNewMatch={() => router.push(`/team/${team.id}/match-new?seasonId=${season.id}`)}
            onOpenMatch={(matchId) => router.push(`/match/${matchId}`)}
          />
        );
      case 'opponents':
        return (
          <SeasonOpponents
            seasonId={season.id}
            onOpenOpponent={(id) => {
              setOpponentId(id);
              router.setParams({ tab: 'matches' });
            }}
          />
        );
      case 'stats':
        return <SeasonStats teamId={team.id} seasonId={season.id} />;
    }
  };
  return (
    <Screen>
      <SeasonTitle name={season.name} />
      <SeasonHeader
        season={season}
        tab={tab}
        onTab={selectTab}
        onEdit={() => router.push(`/team/${team.id}/season-new?seasonId=${season.id}`)}
      />
      <ReadOnlyNote block={access.block} />
      {/* v8: the tab slides in from its side; v8.1: a sideways drag shows the next tab beside it. */}
      <SwipeTabs
        tabs={SEASON_TABS}
        value={tab}
        onChange={selectTab}
        renderTab={renderTab}
        testID="season-tab-swipe"
      />
    </Screen>
  );
}

/** v11: the season's name is the screen's title (kept while the name is the same). */
function SeasonTitle({ name }: { name: string }) {
  const options = useMemo(
    () => ({
      title: name,
      headerTitle: appHeaderOnly(() => <HeaderTitle testID="season-name">{name}</HeaderTitle>),
    }),
    [name],
  );
  return <Stack.Screen options={options} />;
}
