import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { SyncErrorCode, Team } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { uploadTeams } from '@/lib/sync';
import { useSession } from '@/store';

import { SignInFirst, SyncErrorNote } from './MembersNotes';
import { useMembersStyles } from './membersStyles';

/** The error a share left for this screen (`?shareError=`), when it names one. */
function errorParam(t: Strings, value: string | string[] | undefined): SyncErrorCode | null {
  // Own keys only: `in` also accepts "__proto__", "constructor"… (v10 audit L19).
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(t.sync.errors, value)
    ? (value as SyncErrorCode)
    : null;
}

/**
 * v10: a local team's members screen — what sharing does and "Share this team" (uploads it;
 * the screen then shows the members, because the team is now in `sync.teams`). Signed out:
 * "Sign in first".
 */
export function ShareTeam({ team }: { team: Team }) {
  const t = useT();
  const styles = useMembersStyles();
  const router = useRouter();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const params = useLocalSearchParams<{ shareError?: string }>();
  const [error, setError] = useState<SyncErrorCode | null>(() => errorParam(t, params.shareError));
  // v10 audit M7: the account already belongs to a cloud team with this id — this is an older
  // copy of it. Nothing was changed; the cloud's version is downloaded (after a question) under
  // Cloud teams.
  const [inCloud, setInCloud] = useState(false);

  const share = async () => {
    setBusy(true);
    setError(null);
    const result = await uploadTeams([team.id]);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const item = result.value.find((r) => r.teamId === team.id);
    const outcome = item?.result ?? 'failed';
    // The cloud had another team with this id (or the id wasn't allowed), so this one got a new
    // id: its members screen is under the new id — also when sharing then failed, with the
    // reason shown there. Without the new id, the team list is the way back to it.
    if (item?.newTeamId) {
      const shareError = outcome === 'failed' ? (item.error ?? 'unknown') : undefined;
      router.replace({
        pathname: '/team/[teamId]/members',
        params: { teamId: item.newTeamId, ...(shareError ? { shareError } : {}) },
      });
    } else if (outcome === 'failed') setError(item?.error ?? 'unknown');
    else if (outcome === 'rekeyed') router.dismissTo('/teams');
    else if (outcome === 'inCloud') setInCloud(true);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.text}>{t.members.local.intro}</Text>
      {session ? (
        <Button
          label={busy ? t.members.local.sharing : t.members.local.share}
          accessibilityLabel={
            busy ? t.members.local.sharing : t.members.local.shareLabel(team.name)
          }
          onPress={() => void share()}
          disabled={busy}
          testID="members-share-team"
        />
      ) : (
        <SignInFirst message={t.members.local.signInNeeded} />
      )}
      <SyncErrorNote error={error} />
      {inCloud ? (
        <>
          <Text style={styles.text} accessibilityRole="alert" testID="members-share-in-cloud">
            {t.sync.localCopy.inCloud}
          </Text>
          <Button
            label={t.sync.localCopy.openCloudTeams}
            accessibilityLabel={t.sync.localCopy.openCloudTeamsLabel}
            variant="secondary"
            onPress={() => router.push('/account/teams')}
            testID="members-open-cloud-teams"
          />
        </>
      ) : null}
    </View>
  );
}
