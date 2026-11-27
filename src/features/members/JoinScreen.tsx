import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen, TextField } from '@/components';
import { formatInviteCode, normalizeInviteCode } from '@/domain/invites';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import {
  selectCurrentProfile,
  useAppStore,
  useSession,
  useSessionRestoring,
  useSyncAccount,
} from '@/store';

import { CopyQuestion, JoinedNote } from './JoinedNote';
import { needsSignIn, SignInFirst } from './MembersNotes';
import { useMembersStyles } from './membersStyles';
import { useJoin } from './useJoin';

/** The code from `?code=` (shown as "ABCDE-FGHJK" when valid, else as given). */
function initialCode(param: string | string[] | undefined): string {
  const raw = Array.isArray(param) ? (param[0] ?? '') : (param ?? '');
  const code = normalizeInviteCode(raw);
  return code ? formatInviteCode(code) : raw;
}

/**
 * v10: `/join?code=` — join a team with an invite code, also from an invite link (the code is
 * filled in). Needs a profile (else back to `/`) and an account ("Sign in first").
 */
export function JoinScreen() {
  const t = useT();
  const styles = useMembersStyles();
  const params = useLocalSearchParams<{ code?: string }>();
  const profile = useAppStore(selectCurrentProfile);
  const session = useSession();
  // v10 audit M14: on a cold start the stored session is read first; not "Sign in first" yet.
  const restoring = useSessionRestoring();
  const account = useSyncAccount();
  const [code, setCode] = useState(() => initialCode(params.code));
  const [codeParam, setCodeParam] = useState(params.code);
  const { busy, error, joined, join, replaceCopy, keepCopy, clearError, reset } = useJoin();
  // A new invite link while the screen is open (e.g. tapped in another app): start over with it.
  if (params.code !== codeParam) {
    setCodeParam(params.code);
    setCode(initialCode(params.code));
    reset();
  }
  useTourPage(profile ? 'join' : null);

  if (!profile) return <Redirect href="/" />;
  const s = t.members.join;
  // Signed out (or the server says so): "Sign in first" instead of "Join".
  const signIn = !session || needsSignIn(error);
  const waiting = !session && restoring && account !== null;
  const errorText =
    error === 'format' ? s.badFormat : error && !signIn ? t.sync.errors[error] : undefined;
  return (
    <Screen>
      {joined ? (
        <>
          <JoinedNote joined={joined} />
          {/* v10 audit M7: an older copy of the team on this device is only replaced when the
              user says so. */}
          {joined.copy === 'asking' ? (
            <CopyQuestion
              joined={joined}
              busy={busy}
              error={error && error !== 'format' ? t.sync.errors[error] : null}
              onReplace={() => void replaceCopy()}
              onCancel={keepCopy}
            />
          ) : null}
        </>
      ) : (
        <View style={styles.section}>
          <Text style={styles.text}>{s.intro}</Text>
          <TextField
            label={s.code}
            value={code}
            onChangeText={(text) => {
              setCode(text);
              clearError();
            }}
            placeholder={s.placeholder}
            error={errorText}
            // A code, not a word: no capitalisation fixes, autocorrect or spelling marks. No
            // maxLength, because people paste whole invite links.
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            onSubmitEditing={signIn ? undefined : () => void join(code)}
            testID="join-code"
          />
          {waiting ? (
            <Text style={styles.text} testID="account-restoring">
              {t.account.profileSection.restoring}
            </Text>
          ) : signIn ? (
            <SignInFirst message={needsSignIn(error) ? t.sync.errors[error] : s.signInNeeded} />
          ) : (
            <Button
              label={busy ? s.joining : s.submit}
              accessibilityLabel={busy ? s.joining : s.submitLabel}
              onPress={() => void join(code)}
              disabled={busy || code.trim() === ''}
              testID="join-submit"
            />
          )}
        </View>
      )}
    </Screen>
  );
}
