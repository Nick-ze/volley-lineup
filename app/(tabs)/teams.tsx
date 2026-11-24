import { Redirect, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { ProfileHeader } from '@/features/roster/components/ProfileHeader';
import { TeamList } from '@/features/roster/components/TeamList';
import { useTourPage } from '@/features/tour';
import { selectCurrentProfile, useAppStore } from '@/store';

/** `/teams` tab — the selected profile's teams. */
export default function TeamsScreen() {
  const router = useRouter();
  const profile = useAppStore(selectCurrentProfile);
  useTourPage(profile ? 'teams' : null);

  if (!profile) return <Redirect href="/" />;

  return (
    <Screen>
      <ProfileHeader profile={profile} />
      <TeamList profileId={profile.id} onOpen={(team) => router.push(`/team/${team.id}`)} />
    </Screen>
  );
}
