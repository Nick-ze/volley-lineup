import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { Button, Screen, useGoBack } from '@/components';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

import { DownloadPanel } from './DownloadPanel';
import { UploadPanel } from './UploadPanel';
import { useCloudTeams } from './useCloudTeams';

/**
 * v10: `/account/teams` (`?setup=1` right after the first sign-in): upload this profile's teams
 * (unchecked) and download the account's cloud teams (checked). "Done" goes to the Account screen.
 */
export function CloudTeamsScreen() {
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const goBack = useGoBack('/account');
  const { setup } = useLocalSearchParams<{ setup?: string }>();
  useTourPage('cloudTeams');
  const cloud = useCloudTeams();

  return (
    <Screen testID="cloud-teams-screen">
      <Text style={styles.intro}>{t.account.cloudTeams.intro}</Text>
      <UploadPanel teams={cloud.upload} />
      <DownloadPanel
        teams={cloud.download}
        loading={cloud.loading}
        loadError={cloud.error}
        reload={cloud.reload}
      />
      <Button
        label={t.account.cloudTeams.done}
        variant="secondary"
        onPress={() => (setup === '1' ? router.replace('/account') : goBack())}
        testID="cloud-teams-done"
      />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  intro: { ...typography.body, color: theme.colors.text },
}));
