import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components';
import { NotFound } from '@/features/roster/components/NotFound';
import { SeasonHeader } from '@/features/seasons/SeasonHeader';
import { SeasonMatches } from '@/features/seasons/SeasonMatches';
import { SeasonOpponents } from '@/features/seasons/SeasonOpponents';
import { SeasonStats } from '@/features/seasons/SeasonStats';
import { parseSeasonTab } from '@/features/seasons/seasonTabs';
import { useT } from '@/i18n';
import { useOpponentsForSeason, useSeason, useTeam } from '@/store';

/**
 * `/team/[teamId]/season/[seasonId]?tab=matches|opponents|stats` — one season / tournament: its
 * matches (with search), its opponent teams (record per opponent) and its stats (v7.0). Tapping an
 * opponent shows the Matches tab filtered to it (screen state, not a URL param: upgraded opponent
 * ids contain "%", which the router decodes twice).
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

  return (
    <Screen>
      <Stack.Screen options={{ title: team.name }} />
      <SeasonHeader
        season={season}
        tab={tab}
        onTab={(next) => {
          setOpponentId(null);
          router.setParams({ tab: next });
        }}
        onEdit={() => router.push(`/team/${team.id}/season-new?seasonId=${season.id}`)}
      />
      {tab === 'matches' ? (
        <SeasonMatches
          seasonId={season.id}
          opponent={opponent}
          onClearOpponent={() => setOpponentId(null)}
          onNewMatch={() => router.push(`/team/${team.id}/match-new?seasonId=${season.id}`)}
          onOpenMatch={(matchId) => router.push(`/match/${matchId}`)}
        />
      ) : null}
      {tab === 'opponents' ? (
        <SeasonOpponents
          seasonId={season.id}
          onOpenOpponent={(id) => {
            setOpponentId(id);
            router.setParams({ tab: 'matches' });
          }}
        />
      ) : null}
      {tab === 'stats' ? <SeasonStats teamId={team.id} seasonId={season.id} /> : null}
    </Screen>
  );
}
