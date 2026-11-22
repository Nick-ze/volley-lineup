import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Screen, SwipeTabs } from '@/components';
import { PresetsTab } from '@/features/presets/PresetsTab';
import { StartersTab } from '@/features/presets/StartersTab';
import { NotFound } from '@/features/roster/components/NotFound';
import { RosterTab } from '@/features/roster/components/RosterTab';
import { SeasonsTab } from '@/features/seasons/SeasonsTab';
import { StatsTab } from '@/features/stats/StatsTab';
import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { parseTeamTab, TEAM_TABS, type TeamTab } from '@/features/team/tabs';
import { TeamNavBar } from '@/features/team/TeamNavBar';
import { useT } from '@/i18n';
import { useTeam } from '@/store';

/**
 * `/team/[teamId]?tab=roster|matches|presets|starters|stats` — the team with a bottom nav bar
 * (Roster · Matches · Presets · Starters · Stats). Unknown tabs show the roster. v7.0: the
 * Matches tab lists the team's seasons / tournaments; their matches are inside each season.
 */
export default function TeamScreen() {
  const t = useT();
  const router = useRouter();
  const { teamId, tab: tabParam } = useLocalSearchParams<{ teamId: string; tab?: string }>();
  const team = useTeam(teamId);
  const tab = parseTeamTab(tabParam);
  useEffect(markStartupHandled, []);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;

  const id = team.id;
  const selectTab = (next: TeamTab) => router.setParams({ tab: next });
  return (
    <Screen footer={<TeamNavBar value={tab} onChange={selectTab} />}>
      <Stack.Screen options={{ title: team.name }} />
      {/* v8: the tab slides in from its side; a sideways swipe changes the tab. */}
      <SwipeTabs tabs={TEAM_TABS} value={tab} onChange={selectTab} testID="team-tab-swipe">
        {tab === 'roster' ? (
          <RosterTab
            teamId={id}
            onAddPlayer={() => router.push(`/team/${id}/player`)}
            onOpenPlayer={(playerId) => router.push(`/team/${id}/players/${playerId}`)}
          />
        ) : null}
        {tab === 'matches' ? (
          <SeasonsTab
            teamId={id}
            onNewSeason={() => router.push(`/team/${id}/season-new`)}
            onOpenSeason={(seasonId) => router.push(`/team/${id}/season/${seasonId}`)}
          />
        ) : null}
        {tab === 'presets' ? (
          <PresetsTab
            teamId={id}
            onOpenPreset={(presetId) => router.push(`/team/${id}/preset/${presetId}`)}
          />
        ) : null}
        {tab === 'starters' ? (
          <StartersTab teamId={id} onEdit={() => router.push(`/team/${id}/starters`)} />
        ) : null}
        {tab === 'stats' ? <StatsTab teamId={id} /> : null}
      </SwipeTabs>
    </Screen>
  );
}
