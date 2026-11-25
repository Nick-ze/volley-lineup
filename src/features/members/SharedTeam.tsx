import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ConfirmDialog } from '@/components';
import type { TeamRole } from '@/domain/types';
import { useT } from '@/i18n';
import { leaveTeam, removeMember, setMemberRole, type Member } from '@/lib/sync';

import { InviteSection } from './InviteSection';
import { MemberRow } from './MemberRow';
import { needsSignIn, SignInFirst, SyncErrorNote } from './MembersNotes';
import { useMembersStyles } from './membersStyles';
import { useConfirmAction } from './useConfirmAction';
import { useMembers } from './useMembers';

export interface SharedTeamProps {
  teamId: string;
  teamName: string;
  /** The role cached on this device (until the member list says otherwise). */
  cachedRole: TeamRole | null;
}

/**
 * v10: a shared team's members screen. Everyone sees the members and can leave; managers also
 * change roles, remove members and manage invites (players never load invites: RLS hides them).
 */
export function SharedTeam({ teamId, teamName, cachedRole }: SharedTeamProps) {
  const t = useT();
  const styles = useMembersStyles();
  const router = useRouter();
  const state = useMembers(teamId, cachedRole);
  const { ask, dialogProps } = useConfirmAction();
  const { members, invites, busy, run } = state;
  const isManager = state.myRole === 'manager';
  const s = t.members.list;

  const setRole = (member: Member, role: TeamRole) =>
    void run(() => setMemberRole(teamId, member.userId, role));
  const remove = (member: Member) => {
    const name = member.displayName.trim() || s.noName;
    ask(s.removeConfirm(name), s.remove, () => {
      void run(() => removeMember(teamId, member.userId));
    });
  };
  const leave = () =>
    ask(t.members.leave.confirm(teamName), t.members.leave.confirmButton, () => {
      // On success the sync engine removes the team from this device.
      void run(() => leaveTeam(teamId), false).then((ok) => ok && router.dismissTo('/teams'));
    });

  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        {s.heading}
      </Text>
      {members === null && busy ? <Text style={styles.muted}>{s.loading}</Text> : null}
      {members?.map((member) => (
        <MemberRow
          key={member.userId}
          member={member}
          canManage={isManager && !member.isMe}
          disabled={busy}
          onSetRole={setRole}
          onRemove={remove}
        />
      ))}
      {needsSignIn(state.loadError) ? (
        <SignInFirst message={t.members.errors[state.loadError ?? 'notSignedIn']} />
      ) : (
        <SyncErrorNote error={state.loadError} />
      )}
      {state.loadError && !needsSignIn(state.loadError) ? (
        <Button
          label={s.retry}
          accessibilityLabel={s.retryLabel}
          onPress={() => void state.reload()}
          variant="secondary"
          disabled={busy}
          testID="members-retry"
        />
      ) : null}
      {isManager && invites ? (
        <InviteSection
          teamId={teamId}
          teamName={teamName}
          invites={invites}
          busy={busy}
          run={run}
          ask={ask}
        />
      ) : null}
      <SyncErrorNote error={state.actionError} />
      <Button
        label={t.members.leave.button}
        accessibilityLabel={t.members.leave.label(teamName)}
        onPress={leave}
        variant="danger"
        disabled={busy}
        testID="members-leave"
      />
      <ConfirmDialog {...dialogProps} />
    </View>
  );
}
