import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { NotFound, Screen } from '@/components';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useTeam, useTeamAccess } from '@/store';

import { useMembersStyles } from './membersStyles';
import { SharedTeam } from './SharedTeam';
import { ShareTeam } from './ShareTeam';

/**
 * v10: `/team/[teamId]/members` — a local team offers "Share this team"; a shared team shows its
 * members (and, for managers, roles, removing and invites) and "Leave team".
 */
export function MembersScreen({ teamId }: { teamId: string }) {
  const t = useT();
  const styles = useMembersStyles();
  const router = useRouter();
  const team = useTeam(teamId);
  const access = useTeamAccess(teamId);
  useTourPage(team ? 'members' : null);

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;

  return (
    <Screen>
      <Text style={styles.teamName} accessibilityRole="header" numberOfLines={2}>
        {team.name}
      </Text>
      {access.shared ? (
        // Keyed by team: a new team id (never expected here) starts with a fresh list.
        <SharedTeam key={team.id} teamId={team.id} teamName={team.name} cachedRole={access.role} />
      ) : (
        <ShareTeam team={team} />
      )}
    </Screen>
  );
}
