import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '@/components';
import { PresetsTab } from '@/features/presets/PresetsTab';
import { StartersTab } from '@/features/presets/StartersTab';
import { MatchesTab } from '@/features/roster/components/MatchesTab';
import { NotFound } from '@/features/roster/components/NotFound';
import { RosterTab } from '@/features/roster/components/RosterTab';
import { StatsTab } from '@/features/stats/StatsTab';
import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { parseTeamTab } from '@/features/team/tabs';
import { TeamNavBar } from '@/features/team/TeamNavBar';
import { useT } from '@/i18n';
import { useTeam } from '@/store';

/**
 * `/team/[teamId]?tab=roster|matches|presets|starters|stats` — the team with a bottom nav bar
 * (Roster · Matches · Presets · Starters · Stats). Unknown tabs show the roster.
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
  return (
    <Screen
      footer={<TeamNavBar value={tab} onChange={(next) => router.setParams({ tab: next })} />}
    >
      <Stack.Screen options={{ title: t.roster.team.title(team.name, team.season) }} />
      {tab === 'roster' ? (
        <RosterTab
          teamId={id}
          onAddPlayer={() => router.push(`/team/${id}/player`)}
          onOpenPlayer={(playerId) => router.push(`/team/${id}/players/${playerId}`)}
        />
      ) : null}
      {tab === 'matches' ? (
        <MatchesTab
          teamId={id}
          onNewMatch={() => router.push(`/team/${id}/match-new`)}
          onOpenMatch={(matchId) => router.push(`/match/${matchId}`)}
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
    </Screen>
  );
}
