import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { SyncErrorCode } from '@/domain/types';
import { useT } from '@/i18n';

import { useMembersStyles } from './membersStyles';

/** A failed command's message (announced to screen readers); nothing without an error. */
export function SyncErrorNote({ error }: { error: SyncErrorCode | null }) {
  const t = useT();
  const styles = useMembersStyles();
  if (!error) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {t.members.errors[error]}
    </Text>
  );
}

/** "You need an account…" with a "Sign in first" button that opens the sign-in screen. */
export function SignInFirst({ message }: { message: string }) {
  const t = useT();
  const styles = useMembersStyles();
  const router = useRouter();
  return (
    <View style={styles.section}>
      <Text style={styles.text}>{message}</Text>
      <Button
        label={t.members.local.signIn}
        accessibilityLabel={t.members.local.signInLabel}
        onPress={() => router.push('/account/sign-in')}
        testID="members-sign-in"
      />
    </View>
  );
}

/** Errors that mean "sign in (again)" rather than "try again". */
export const needsSignIn = (error: string | null): error is 'notSignedIn' | 'signedOut' =>
  error === 'notSignedIn' || error === 'signedOut';
