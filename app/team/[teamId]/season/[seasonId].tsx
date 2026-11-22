import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

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
 * `/team/[teamId]/season/[seasonId]?tab=matches|opponents|stats&opponent=` — one season /
 * tournament: its matches (with search; `opponent` filters them to one opponent), its opponent
 * teams (record per opponent) and its stats (v7.0).
 */
export default function SeasonScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{
    teamId: string;
    seasonId: string;
    tab?: string;
    opponent?: string;
  }>();
  const team = useTeam(params.teamId);
  const season = useSeason(params.seasonId);
  const opponents = useOpponentsForSeason(season?.id);
  const tab = parseSeasonTab(params.tab);
  const opponent = opponents.find((o) => o.id === params.opponent);

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
      <Stack.Screen options={{ title: t.roster.team.title(team.name, team.season) }} />
      <SeasonHeader
        season={season}
        tab={tab}
        onTab={(next) => router.setParams({ tab: next, opponent: undefined })}
        onEdit={() => router.push(`/team/${team.id}/season-new?seasonId=${season.id}`)}
      />
      {tab === 'matches' ? (
        <SeasonMatches
          seasonId={season.id}
          opponent={opponent}
          onClearOpponent={() => router.setParams({ opponent: undefined })}
          onNewMatch={() => router.push(`/team/${team.id}/match-new?seasonId=${season.id}`)}
          onOpenMatch={(matchId) => router.push(`/match/${matchId}`)}
        />
      ) : null}
      {tab === 'opponents' ? (
        <SeasonOpponents
          seasonId={season.id}
          onOpenOpponent={(id) => router.setParams({ tab: 'matches', opponent: id })}
        />
      ) : null}
      {tab === 'stats' ? <SeasonStats teamId={team.id} seasonId={season.id} /> : null}
    </Screen>
  );
}
