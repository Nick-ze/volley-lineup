import { useRouter } from 'expo-router';
import { Image } from 'react-native';

import { Screen } from '@/components';
import { ProfilePicker } from '@/features/roster/components/ProfilePicker';
import { useStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { makeStyles, radius, touchTarget, spacing } from '@/theme';

/** The app's mark above the title (the launcher icon). */
const MARK = require('../assets/images/icon.png');

/** `/` — choose (or create / rename / delete) a manager profile. */
export default function ProfilePickerScreen() {
  const router = useRouter();
  const styles = useStyles();
  const t = useT();
  useStartupRedirect();
  useTourPage('profiles');

  return (
    <Screen
      title={{
        title: t.roster.profiles.heading,
        eyebrow: t.nav.profiles,
        size: 'l',
        mark: (
          <Image
            source={MARK}
            style={styles.mark}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ),
      }}
    >
      <ProfilePicker
        onSelect={(id) => {
          useAppStore.getState().selectProfile(id);
          router.push('/teams');
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  mark: {
    width: touchTarget + spacing.md,
    height: touchTarget + spacing.md,
    borderRadius: radius.md,
  },
}));
