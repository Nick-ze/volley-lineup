import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Screen, TextField } from '@/components';
import { formatInviteCode, normalizeInviteCode } from '@/domain/invites';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore, useSession, useTeam } from '@/store';

import { SignInFirst } from './MembersNotes';
import { useMembersStyles } from './membersStyles';
import { useJoin, type Joined } from './useJoin';

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
  const [code, setCode] = useState(() => initialCode(params.code));
  const { busy, error, joined, join, clearError } = useJoin();
  useTourPage(profile ? 'join' : null);

  if (!profile) return <Redirect href="/" />;
  const s = t.members.join;
  const errorText = error === 'format' ? s.badFormat : error ? t.members.errors[error] : undefined;
  return (
    <Screen>
      {joined ? (
        <JoinedNote joined={joined} />
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
            onSubmitEditing={session ? () => void join(code) : undefined}
            testID="join-code"
          />
          {session ? (
            <Button
              label={busy ? s.joining : s.submit}
              accessibilityLabel={busy ? s.joining : s.submitLabel}
              onPress={() => void join(code)}
              disabled={busy || code.trim() === ''}
              testID="join-submit"
            />
          ) : (
            <SignInFirst message={s.signInNeeded} />
          )}
        </View>
      )}
    </Screen>
  );
}

/** "You joined <team> as <role>" and "Open team" (the team list while it is still downloading). */
function JoinedNote({ joined }: { joined: Joined }) {
  const t = useT();
  const styles = useMembersStyles();
  const router = useRouter();
  const team = useTeam(joined.teamId);
  const s = t.members.join;
  const name = team?.name ?? joined.name;
  const role = t.members.roleInText[joined.role];
  return (
    <View style={styles.section}>
      <Text style={styles.text} accessibilityRole="alert" testID="join-success">
        {name ? s.joined(name, role) : s.joinedUnnamed(role)}
      </Text>
      <Button
        label={s.open}
        accessibilityLabel={name ? s.openLabel(name) : s.open}
        onPress={() =>
          team
            ? router.replace({ pathname: '/team/[teamId]', params: { teamId: team.id } })
            : router.replace('/teams')
        }
        testID="join-open"
      />
    </View>
  );
}
