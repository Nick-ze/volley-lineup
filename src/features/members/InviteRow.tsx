import { Text, View } from 'react-native';

import { Button } from '@/components';
import { formatTimestampDate } from '@/domain/dates';
import { formatInviteCode } from '@/domain/invites';
import { useT } from '@/i18n';
import { canShareText } from '@/lib/share';
import type { Invite } from '@/lib/sync';

import { useMembersStyles } from './membersStyles';

export interface InviteRowProps {
  invite: Invite;
  disabled: boolean;
  onShare: (invite: Invite) => void;
  onRevoke: (invite: Invite) => void;
}

/** v10: an active invite — code "ABCDE-FGHJK", role, expiry (dd.mm.yy), uses; Share / Revoke. */
export function InviteRow({ invite, disabled, onShare, onRevoke }: InviteRowProps) {
  const t = useT();
  const styles = useMembersStyles();
  const s = t.members.invites;
  const code = formatInviteCode(invite.code);
  // Without a share sheet (desktop browsers) the button copies the invite instead.
  const sheet = canShareText();
  return (
    <View style={styles.row} testID={`invite-${invite.id}`}>
      <View style={styles.rowMain}>
        <Text style={styles.code} selectable>
          {code}
        </Text>
        <Text style={styles.rowDetail}>
          {s.details(
            t.members.roles[invite.role],
            formatTimestampDate(invite.expiresAt),
            invite.uses,
          )}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={sheet ? s.share : s.copy}
          accessibilityLabel={sheet ? s.shareLabel(code) : s.copyLabel(code)}
          onPress={() => onShare(invite)}
          variant="secondary"
          compact
          testID={`invite-share-${invite.id}`}
        />
        <Button
          label={s.revoke}
          accessibilityLabel={s.revokeLabel(code)}
          onPress={() => onRevoke(invite)}
          variant="danger"
          compact
          disabled={disabled}
          testID={`invite-revoke-${invite.id}`}
        />
      </View>
    </View>
  );
}
