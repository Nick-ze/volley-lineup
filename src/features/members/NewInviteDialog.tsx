import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ChoiceChip, Dialog, useDialogStyles } from '@/components';
import {
  DEFAULT_INVITE_DAYS,
  DEFAULT_INVITE_ROLE,
  inviteDayOptions,
  inviteDaysFor,
  type InviteDays,
} from '@/domain/invites';
import type { TeamRole } from '@/domain/types';
import { useT } from '@/i18n';

import { useMembersStyles } from './membersStyles';

const ROLES: TeamRole[] = ['player', 'manager'];

export interface NewInviteDialogProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (role: TeamRole, days: InviteDays) => void;
}

/**
 * v10: "New invite" — role (player / manager) and how long it is valid: 1 / 7 / 30 days for a
 * player code, 1 / 7 days for a manager code (the server refuses longer ones, audit H5).
 */
export function NewInviteDialog({ visible, onCancel, onCreate }: NewInviteDialogProps) {
  const t = useT();
  const styles = useMembersStyles();
  const dialogStyles = useDialogStyles();
  const s = t.members.newInviteDialog;
  const [role, setRole] = useState<TeamRole>(DEFAULT_INVITE_ROLE);
  const [days, setDays] = useState<InviteDays>(DEFAULT_INVITE_DAYS);
  return (
    <Dialog visible={visible} onClose={onCancel} title={s.title} testID="new-invite-dialog">
      <View style={styles.section}>
        <Text style={styles.rowDetail}>{s.role}</Text>
        <View style={styles.choices} accessibilityRole="radiogroup" aria-label={s.role}>
          {ROLES.map((r) => (
            <ChoiceChip
              key={r}
              role="radio"
              label={t.members.roles[r]}
              selected={role === r}
              onPress={() => {
                setRole(r);
                setDays((d) => inviteDaysFor(r, d));
              }}
              testID={`new-invite-role-${r}`}
            />
          ))}
        </View>
        <Text style={styles.muted}>{s.roleHint[role]}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.rowDetail}>{s.days}</Text>
        <View style={styles.choices} accessibilityRole="radiogroup" aria-label={s.days}>
          {inviteDayOptions(role).map((d) => (
            <ChoiceChip
              key={d}
              role="radio"
              label={s.dayOption(d)}
              selected={days === d}
              onPress={() => setDays(d)}
              testID={`new-invite-days-${d}`}
            />
          ))}
        </View>
      </View>
      <View style={dialogStyles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button
          label={s.create}
          accessibilityLabel={s.createLabel}
          onPress={() => onCreate(role, days)}
          testID="new-invite-create"
        />
      </View>
    </Dialog>
  );
}
