import { useRouter } from 'expo-router';

import { Screen } from '@/components';
import { ProfilePicker } from '@/features/roster/components/ProfilePicker';
import { useStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { useTourPage } from '@/features/tour';
import { useAppStore } from '@/store';

/** `/` — choose (or create / rename / delete) a manager profile. */
export default function ProfilePickerScreen() {
  const router = useRouter();
  useStartupRedirect();
  useTourPage('profiles');

  return (
    <Screen>
      <ProfilePicker
        onSelect={(id) => {
          useAppStore.getState().selectProfile(id);
          router.push('/teams');
        }}
      />
    </Screen>
  );
}
