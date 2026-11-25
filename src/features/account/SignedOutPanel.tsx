import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { Button } from '@/components';
import type { AccountLink } from '@/domain/syncSetup';
import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

export interface SignedOutPanelProps {
  link: Exclude<AccountLink, { kind: 'signedIn' }>;
  /** testID of the Sign in button. */
  testID?: string;
}

/**
 * v10: what the account entry points show when this profile isn't signed in: Sign in, "open a
 * profile first", or that the device's account belongs to another profile.
 */
export function SignedOutPanel({ link, testID }: SignedOutPanelProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.account.profileSection;
  const router = useRouter();
  switch (link.kind) {
    case 'noProfile':
      return (
        <>
          <Text style={styles.text}>{t.account.signIn.noProfile}</Text>
          <Button label={t.account.signIn.openProfiles} onPress={() => router.replace('/')} />
        </>
      );
    case 'otherProfile':
      return (
        <Text style={styles.text} testID="account-other-profile">
          {s.otherProfile(link.email, link.profileName)}
        </Text>
      );
    default:
      return (
        <>
          <Text style={styles.text}>{s.signedOut}</Text>
          <Button
            label={s.signIn}
            accessibilityLabel={s.signInLabel}
            onPress={() => router.push('/account/sign-in')}
            testID={testID}
          />
        </>
      );
  }
}

const useStyles = makeStyles((theme) => ({
  text: { ...typography.body, color: theme.colors.text },
}));
