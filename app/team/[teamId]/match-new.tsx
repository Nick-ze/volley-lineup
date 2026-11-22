import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { firstSetForNewMatch } from '@/domain/presets';
import { findOpponentByName, foldName, seasonsForTeam } from '@/domain/seasons';
import { MatchForm } from '@/features/roster/components/MatchForm';
import { NotFound } from '@/features/roster/components/NotFound';
import { useGoBack } from '@/features/roster/hooks/useGoBack';
import { useT } from '@/i18n';
import { selectPlayersForTeam, useAppStore, useTeam } from '@/store';

/**
 * `/team/[teamId]/match-new?seasonId=` — create a match in a season, then open it. Modal.
 * v7.0: the form picks the season (fixed by `seasonId`, else a choice defaulting to the newest,
 * else a new one named in the form) and the opponent (one of the season's, or a new name, which
 * is added to the season first).
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
        teamId={team.id}
        seasonId={seasonId}
        onCancel={goBack}
        onSubmit={({ season, opponent, date, home }) => {
          const store = useAppStore.getState();
          // Set 1 starts with the team's starters (v6.2: also partly filled ones).
          const players = selectPlayersForTeam(store, team.id);
          const first = firstSetForNewMatch(store.presets, team.id, players);
          // Fresh state for every lookup: a quick second press must reuse what the first added.
          const inSeason =
            season.kind === 'existing'
              ? season.id
              : (
                  seasonsForTeam(useAppStore.getState().seasons, team.id).find(
                    (x) => foldName(x.name) === foldName(season.name),
                  ) ?? store.addSeason({ teamId: team.id, name: season.name, kind: 'season' })
                ).id;
          // The form only offers this season's opponents, so an existing one is always found.
          const opp =
            opponent.kind === 'new'
              ? (findOpponentByName(useAppStore.getState().opponents, inSeason, opponent.name) ??
                store.addOpponent(inSeason, opponent.name))
              : useAppStore.getState().opponents.find((o) => o.id === opponent.id);
          if (!opp) return;
          const match = store.addMatch({
            teamId: team.id,
            seasonId: inSeason,
            opponentId: opp.id,
            opponent: opp.name,
            date,
            home,
            sets: [first],
          });
          router.replace(`/match/${match.id}`);
        }}
      />
    </Screen>
  );
}
