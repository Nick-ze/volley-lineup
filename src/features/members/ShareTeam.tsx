import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { SyncErrorCode, Team } from '@/domain/types';
import { useT } from '@/i18n';
import { uploadTeams } from '@/lib/sync';
import { useSession } from '@/store';

import { SignInFirst, SyncErrorNote } from './MembersNotes';
import { useMembersStyles } from './membersStyles';

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
  const [error, setError] = useState<SyncErrorCode | null>(null);

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
    if (outcome === 'failed') setError(item?.error ?? 'unknown');
    // The cloud had another team with this id, so this one got a new id: its members screen is
    // under the new id (the team list when the id isn't known).
    else if (outcome === 'rekeyed') {
      if (item?.newTeamId) {
        router.replace({ pathname: '/team/[teamId]/members', params: { teamId: item.newTeamId } });
      } else router.dismissTo('/teams');
    }
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
    </View>
  );
}
