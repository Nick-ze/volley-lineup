import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { appHeaderOnly, Button, HeaderTitle, NotFound, Screen, SwipeTabs } from '@/components';
import type { HostedTournament } from '@/domain/types';
import { TournamentMatches } from '@/features/hostedTournament/TournamentMatches';
import { TournamentMeta } from '@/features/hostedTournament/TournamentMeta';
import { TournamentTabBar } from '@/features/hostedTournament/TournamentTabBar';
import { TournamentTeams } from '@/features/hostedTournament/TournamentTeams';
import {
  defaultTournamentTab,
  parseTournamentTab,
  TOURNAMENT_TABS,
  type TournamentTab,
} from '@/features/hostedTournament/tournamentTabs';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore, useHostedTournament } from '@/store';

/**
 * `/tournament/[tournamentId]?tab=matches|teams` — one hosted tournament (v12): its name as the
 * title, Edit in the header, the quiet line with date, place and format, then the tabs (chips
 * with swipe, like a season). It opens on Teams while there are fewer than two teams, otherwise
 * on Matches; `?tab=` wins.
 */
export default function TournamentScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ tournamentId: string; tab?: string }>();
  const profile = useAppStore(selectCurrentProfile);
  const tournament = useHostedTournament(params.tournamentId);
  // Where the screen opens is decided once: adding the second team must not switch the tab.
  const [opensOn] = useState<TournamentTab>(() =>
    defaultTournamentTab(
      useAppStore.getState().hostedTeams.filter((x) => x.tournamentId === params.tournamentId)
        .length,
    ),
  );
  const tab = parseTournamentTab(params.tab, opensOn);

  if (!profile) return <Redirect href="/" />;
  if (!tournament || tournament.profileId !== profile.id)
    return (
      <NotFound
        message={t.tournament.form.notFound}
        onBack={() => router.dismissTo('/tournaments')}
        backLabel={t.tournament.form.back}
      />
    );

  const selectTab = (next: TournamentTab) => router.setParams({ tab: next });
  const renderTab = (shown: TournamentTab) => {
    switch (shown) {
      case 'matches':
        return (
          <TournamentMatches
            tournament={tournament}
            onOpenMatch={(a, b) => router.push(`/tournament/${tournament.id}/match?a=${a}&b=${b}`)}
          />
        );
      case 'teams':
        return <TournamentTeams tournamentId={tournament.id} />;
    }
  };

  return (
    <Screen testID="tournament-screen">
      <TournamentHeader
        tournament={tournament}
        onEdit={() => router.push(`/tournament-new?tournamentId=${tournament.id}`)}
      />
      <TournamentMeta tournament={tournament} />
      <TournamentTabBar tab={tab} onTab={selectTab} />
      <SwipeTabs
        tabs={TOURNAMENT_TABS}
        value={tab}
        onChange={selectTab}
        renderTab={renderTab}
        testID="tournament-tab-swipe"
      />
    </Screen>
  );
}

/** The header options, kept while the name is the same (no `setOptions` per render). */
function TournamentHeader({
  tournament,
  onEdit,
}: {
  tournament: HostedTournament;
  onEdit: () => void;
}) {
  const t = useT();
  const s = t.tournament.screen;
  const { name } = tournament;
  const options = useMemo(
    () => ({
      title: name,
      headerTitle: appHeaderOnly(() => <HeaderTitle testID="tournament-name">{name}</HeaderTitle>),
      headerRight: appHeaderOnly(() => (
        <Button
          label={s.edit}
          accessibilityLabel={s.editLabel(name)}
          variant="secondary"
          compact
          onPress={onEdit}
          testID="tournament-edit"
        />
      )),
    }),
    [name, s, onEdit],
  );
  return <Stack.Screen options={options} />;
}
