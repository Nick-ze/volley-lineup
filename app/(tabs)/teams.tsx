import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components';
import { Avatar } from '@/features/roster/components/Avatar';
import { TeamList } from '@/features/roster/components/TeamList';
import { JoinTeamButton } from '@/features/sync/JoinTeamButton';
import { SyncBadge } from '@/features/sync/SyncBadge';
import { SyncNotices } from '@/features/sync/SyncNotices';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore } from '@/store';
import { makeStyles, spacing } from '@/theme';

/** Diameter of the profile's picture beside the title. */
const TITLE_AVATAR = 40;

/**
 * `/teams` tab — the selected profile's teams. v11: the title is on the page, with the profile's
 * name above it and the sync badge and the profile's picture at the right. v10: sync notices
 * above the list and "Join a team" beside "New team".
 */
export default function TeamsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const t = useT();
  const profile = useAppStore(selectCurrentProfile);
  useTourPage(profile ? 'teams' : null);

  if (!profile) return <Redirect href="/" />;

  return (
    <Screen
      testID="teams-screen"
      title={{
        title: t.nav.teams,
        eyebrow: profile.name,
        right: (
          <View style={styles.right}>
            <SyncBadge />
            <Avatar
              name={profile.name}
              color={profile.color}
              photoId={profile.photoId}
              size={TITLE_AVATAR}
            />
          </View>
        ),
      }}
    >
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
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flexGrow: 1 },
}));
