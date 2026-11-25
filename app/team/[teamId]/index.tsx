import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { HeaderTitle, NotFound, Screen, SwipeTabs, TeamAvatar } from '@/components';
import { teamTabPage } from '@/domain/tour';
import type { Team } from '@/domain/types';
import { PresetsTab } from '@/features/presets/PresetsTab';
import { StartersTab } from '@/features/presets/StartersTab';
import { RosterTab } from '@/features/roster/components/RosterTab';
import { SeasonsTab } from '@/features/seasons/SeasonsTab';
import { StatsTab } from '@/features/stats/StatsTab';
import { MembersHeaderButton } from '@/features/members/MembersHeaderButton';
import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { parseTeamTab, TEAM_TABS, type TeamTab } from '@/features/team/tabs';
import { TeamNavBar } from '@/features/team/TeamNavBar';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useTeam } from '@/store';

/** Diameter of the team picture in the header. */
const TEAM_HEADER_AVATAR = 32;

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
  // v9.0: the shown tab's tips (never in the tabs: the pager keeps their neighbours mounted).
  useTourPage(team ? teamTabPage(tab) : null);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;

  const id = team.id;
  const selectTab = (next: TeamTab) => router.setParams({ tab: next });
  const renderTab = (shown: TeamTab) => {
    switch (shown) {
      case 'roster':
        return (
          <RosterTab
            teamId={id}
            onAddPlayer={() => router.push(`/team/${id}/player`)}
            onOpenPlayer={(playerId) => router.push(`/team/${id}/players/${playerId}`)}
          />
        );
      case 'matches':
        return (
          <SeasonsTab
            teamId={id}
            onNewSeason={() => router.push(`/team/${id}/season-new`)}
            onOpenSeason={(seasonId) => router.push(`/team/${id}/season/${seasonId}`)}
          />
        );
      case 'presets':
        return (
          <PresetsTab
            teamId={id}
            onOpenPreset={(presetId) => router.push(`/team/${id}/preset/${presetId}`)}
          />
        );
      case 'starters':
        return <StartersTab teamId={id} onEdit={() => router.push(`/team/${id}/starters`)} />;
      case 'stats':
        return <StatsTab teamId={id} />;
    }
  };
  return (
    <Screen footer={<TeamNavBar value={tab} onChange={selectTab} />}>
      <TeamHeader team={team} />
      {/* v8: the tab slides in from its side; v8.1: a sideways drag shows the next tab beside it. */}
      <SwipeTabs
        tabs={TEAM_TABS}
        value={tab}
        onChange={selectTab}
        renderTab={renderTab}
        testID="team-tab-swipe"
      />
    </Screen>
  );
}

/** The header options, kept while the team is unchanged (v8.3: no `setOptions` per render). */
function TeamHeader({ team }: { team: Team }) {
  // v10: the width of the "Members" / "Share" button, kept free beside the title.
  const [buttonWidth, setButtonWidth] = useState(0);
  const options = useMemo(
    () => ({
      title: team.name,
      // v8: the team picture (or initial) before the name.
      headerTitle: () => (
        <HeaderTitle
          leading={<TeamAvatar team={team} size={TEAM_HEADER_AVATAR} />}
          trailingRoom={buttonWidth}
        >
          {team.name}
        </HeaderTitle>
      ),
      // v10: "Members" / "Share" (only when the app has a backend configured).
      headerRight: () => (
        <MembersHeaderButton teamId={team.id} teamName={team.name} onWidth={setButtonWidth} />
      ),
    }),
    [team, buttonWidth],
  );
  return <Stack.Screen options={options} />;
}
