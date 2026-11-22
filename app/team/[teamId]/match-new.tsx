import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { firstSetForNewMatch } from '@/domain/presets';
import { findOpponentByName, seasonsForTeam } from '@/domain/seasons';
import { MatchForm } from '@/features/roster/components/MatchForm';
import { NotFound } from '@/features/roster/components/NotFound';
import { useGoBack } from '@/features/roster/hooks/useGoBack';
import { useT } from '@/i18n';
import { selectPlayersForTeam, useAppStore, useTeam } from '@/store';

/**
 * `/team/[teamId]/match-new?seasonId=` — create a match in a season, then open it. Modal.
 * v7.0: without a (valid) `seasonId` the team's newest season is used, or one is created
 * (named after the current year). The opponent is the season's opponent of that name, or a new one.
 */
export default function NewMatchScreen() {
  const t = useT();
  const router = useRouter();
  const { teamId, seasonId } = useLocalSearchParams<{ teamId: string; seasonId?: string }>();
  const team = useTeam(teamId);
  const goBack = useGoBack(
    seasonId ? `/team/${teamId}/season/${seasonId}` : `/team/${teamId}?tab=matches`,
  );

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;

  return (
    <Screen>
      <MatchForm
        onCancel={goBack}
        onSubmit={(value) => {
          const store = useAppStore.getState();
          // Set 1 starts with the team's starters (v6.2: also partly filled ones).
          const players = selectPlayersForTeam(store, team.id);
          const first = firstSetForNewMatch(store.presets, team.id, players);
          const season =
            store.seasons.find((x) => x.id === seasonId && x.teamId === team.id) ??
            seasonsForTeam(store.seasons, team.id)[0] ??
            store.addSeason({
              teamId: team.id,
              name: String(new Date().getFullYear()),
              kind: 'season',
            });
          const opponent =
            findOpponentByName(useAppStore.getState().opponents, season.id, value.opponent) ??
            store.addOpponent(season.id, value.opponent);
          const match = store.addMatch({
            teamId: team.id,
            seasonId: season.id,
            opponentId: opponent.id,
            ...value,
            opponent: opponent.name,
            sets: [first],
          });
          router.replace(`/match/${match.id}`);
        }}
      />
    </Screen>
  );
}
