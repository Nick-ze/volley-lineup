import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '@/components';
import { MatchesTab } from '@/features/roster/components/MatchesTab';
import { NotFound } from '@/features/roster/components/NotFound';
import { RosterTab } from '@/features/roster/components/RosterTab';
import { SegmentedTabs } from '@/features/roster/components/SegmentedTabs';
import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { t } from '@/i18n/en';
import { useTeam } from '@/store';

type Tab = 'roster' | 'matches';

const TABS = [
  { key: 'roster', label: t.roster.team.rosterTab },
  { key: 'matches', label: t.roster.team.matchesTab },
] as const;

/** `/team/[teamId]?tab=roster|matches` — Roster | Matches. */
export default function TeamScreen() {
  const router = useRouter();
  const { teamId, tab: tabParam } = useLocalSearchParams<{ teamId: string; tab?: string }>();
  const team = useTeam(teamId);
  const tab: Tab = tabParam === 'matches' ? 'matches' : 'roster';
  useEffect(markStartupHandled, []);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;

  return (
    <Screen>
      <Stack.Screen options={{ title: t.roster.team.title(team.name, team.season) }} />
      <SegmentedTabs<Tab>
        tabs={TABS}
        value={tab}
        onChange={(next) => router.setParams({ tab: next })}
        accessibilityLabel={t.roster.team.tabs}
      />
      {tab === 'roster' ? (
        <RosterTab
          teamId={team.id}
          onAddPlayer={() => router.push(`/team/${team.id}/player`)}
          onEditPlayer={(playerId) => router.push(`/team/${team.id}/player?playerId=${playerId}`)}
        />
      ) : (
        <MatchesTab
          teamId={team.id}
          onNewMatch={() => router.push(`/team/${team.id}/match-new`)}
          onOpenMatch={(matchId) => router.push(`/match/${matchId}`)}
        />
      )}
    </Screen>
  );
}
