import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import { LocalCopyDialog } from '@/features/sync/LocalCopyDialog';
import { useT } from '@/i18n';
import { useTeam } from '@/store';

import { useMembersStyles } from './membersStyles';
import type { Joined } from './useJoin';

/** The question about the older copy of the joined team on this device (v10 audit M7). */
export function CopyQuestion({
  joined,
  busy,
  error,
  onReplace,
  onCancel,
}: {
  joined: Joined;
  busy: boolean;
  /** Why the download failed, when it did. */
  error: string | null;
  onReplace: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const team = useTeam(joined.teamId);
  // The copy's own name first: it is the copy the question is about.
  const name = team?.name ?? joined.name ?? t.account.cloudTeams.download.unnamed;
  return (
    <LocalCopyDialog
      copies={[{ name, manager: joined.role === 'manager' }]}
      busy={busy}
      error={error}
      onReplace={onReplace}
      onCancel={onCancel}
    />
  );
}

/**
 * "You joined <team> as <role>" and "Open team" (the team list while it is still downloading).
 * While an older copy of the team on this device hasn't been replaced (v10 audit M7), the note
 * says so and leads to Cloud teams instead: "Open team" would open the old copy.
 */
export function JoinedNote({ joined }: { joined: Joined }) {
  const t = useT();
  const styles = useMembersStyles();
  const router = useRouter();
  const team = useTeam(joined.teamId);
  const s = t.members.join;
  const name = team?.name ?? joined.name;
  const role = t.members.roleInText[joined.role];
  if (joined.copy === 'ended') {
    // No longer a member (removed, or the team was deleted, before the question was answered):
    // the copy stays what it is, a local team.
    return (
      <View style={styles.section}>
        <Text style={styles.text} accessibilityRole="alert" testID="join-not-member">
          {t.sync.notices.removed(name ?? t.account.cloudTeams.download.unnamed)}
        </Text>
      </View>
    );
  }
  if (joined.copy) {
    const copy = t.sync.localCopy;
    return (
      <View style={styles.section}>
        <Text style={styles.text} accessibilityRole="alert" testID="join-copy-kept">
          {copy.later(name ?? t.account.cloudTeams.download.unnamed)}
        </Text>
        {joined.copy === 'kept' ? (
          <Button
            label={copy.openCloudTeams}
            accessibilityLabel={copy.openCloudTeamsLabel}
            onPress={() => router.replace('/account/teams')}
            testID="join-cloud-teams"
          />
        ) : null}
      </View>
    );
  }
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
