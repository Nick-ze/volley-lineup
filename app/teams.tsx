import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '@/components';
import { HeaderButton } from '@/features/roster/components/HeaderButton';
import { ProfileHeader } from '@/features/roster/components/ProfileHeader';
import { TeamList } from '@/features/roster/components/TeamList';
import { markStartupHandled } from '@/features/roster/hooks/useStartupRedirect';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore } from '@/store';

/** `/teams` — the selected profile's teams. */
export default function TeamsScreen() {
  const t = useT();
  const router = useRouter();
  const profile = useAppStore(selectCurrentProfile);
  useEffect(markStartupHandled, []);

  if (!profile) return <Redirect href="/" />;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton
              label={t.roster.teams.settings}
              onPress={() => router.push('/settings')}
            />
          ),
        }}
      />
      <ProfileHeader profile={profile} onSwitch={() => router.dismissTo('/')} />
      <TeamList profileId={profile.id} onOpen={(team) => router.push(`/team/${team.id}`)} />
    </Screen>
  );
}
