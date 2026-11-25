import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import { formatInviteCode, joinLink, type InviteDays } from '@/domain/invites';
import type { TeamRole } from '@/domain/types';
import { useT } from '@/i18n';
import { shareText, webAppBase, type ShareOutcome } from '@/lib/share';
import { createInvite, revokeInvite, type Invite, type SyncResult } from '@/lib/sync';

import { InviteRow } from './InviteRow';
import { useMembersStyles } from './membersStyles';
import { NewInviteDialog } from './NewInviteDialog';

export interface InviteSectionProps {
  teamId: string;
  teamName: string;
  /** The active invites (see `useMembers`). */
  invites: Invite[];
  busy: boolean;
  run: (command: () => Promise<SyncResult<unknown>>) => Promise<boolean>;
  /** Asks before an action (the screen's confirm dialog). */
  ask: (message: string, confirmLabel: string, action: () => void) => void;
}

/** v10 (managers only): the team's active invites, Share / Copy, Revoke and "New invite". */
export function InviteSection({ teamId, teamName, invites, busy, run, ask }: InviteSectionProps) {
  const t = useT();
  const styles = useMembersStyles();
  const s = t.members.invites;
  const [creating, setCreating] = useState(false);
  const [shared, setShared] = useState<ShareOutcome | null>(null);

  const share = async (invite: Invite) => {
    setShared(null);
    const code = formatInviteCode(invite.code);
    const link = joinLink(invite.code, webAppBase());
    setShared(await shareText(s.shareMessage(teamName, code, link), s.shareTitle(teamName)));
  };
  const revoke = (invite: Invite) =>
    ask(s.revokeConfirm(formatInviteCode(invite.code)), s.revoke, () => {
      void run(() => revokeInvite(invite.id));
    });
  const create = (role: TeamRole, days: InviteDays) => {
    setCreating(false);
    void run(() => createInvite(teamId, role, days));
  };

  return (
    <View style={styles.section} testID="invite-section">
      <Text style={styles.heading} accessibilityRole="header">
        {s.heading}
      </Text>
      {invites.length === 0 ? <Text style={styles.muted}>{s.none}</Text> : null}
      {invites.map((invite) => (
        <InviteRow
          key={invite.id}
          invite={invite}
          disabled={busy}
          onShare={(i) => void share(i)}
          onRevoke={revoke}
        />
      ))}
      {shared === 'copied' || shared === 'failed' ? (
        <Text style={styles.muted} accessibilityLiveRegion="polite" testID="invite-share-result">
          {shared === 'copied' ? s.copied : s.shareFailed}
        </Text>
      ) : null}
      <Button
        label={t.members.newInvite}
        accessibilityLabel={t.members.newInviteLabel}
        onPress={() => setCreating(true)}
        disabled={busy}
        testID="members-new-invite"
      />
      {creating ? (
        <NewInviteDialog visible onCancel={() => setCreating(false)} onCreate={create} />
      ) : null}
    </View>
  );
}
