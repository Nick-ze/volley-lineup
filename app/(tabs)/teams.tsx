import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components';
import { ProfileHeader } from '@/features/roster/components/ProfileHeader';
import { TeamList } from '@/features/roster/components/TeamList';
import { JoinTeamButton } from '@/features/sync/JoinTeamButton';
import { SyncBadge } from '@/features/sync/SyncBadge';
import { SyncNotices } from '@/features/sync/SyncNotices';
import { useTourPage } from '@/features/tour';
import { selectCurrentProfile, useAppStore } from '@/store';
import { makeStyles, spacing } from '@/theme';

/**
 * `/teams` tab — the selected profile's teams. v10: the sync badge beside the heading, sync
 * notices above the list and "Join a team" beside "New team".
 */
export default function TeamsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const profile = useAppStore(selectCurrentProfile);
  useTourPage(profile ? 'teams' : null);

  if (!profile) return <Redirect href="/" />;

  return (
    <Screen>
      <View style={styles.header}>
        <ProfileHeader profile={profile} />
        <SyncBadge />
      </View>
      <SyncNotices />
      <TeamList
        profileId={profile.id}
        onOpen={(team) => router.push(`/team/${team.id}`)}
        actions={<JoinTeamButton style={styles.grow} />}
      />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  // The badge sits at the right of the heading, or wraps below it when the row is too narrow.
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  grow: { flexGrow: 1 },
}));
