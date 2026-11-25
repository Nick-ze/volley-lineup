import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { TeamRole } from '@/domain/types';
import { useT } from '@/i18n';
import type { Member } from '@/lib/sync';

import { useMembersStyles } from './membersStyles';

export interface MemberRowProps {
  member: Member;
  /** Shows "Make manager / player" and "Remove" (managers, on other members' rows). */
  canManage: boolean;
  disabled: boolean;
  onSetRole: (member: Member, role: TeamRole) => void;
  onRemove: (member: Member) => void;
}

/** v10: one member — display name (never an email), "(you)", role; managers' controls. */
export function MemberRow({ member, canManage, disabled, onSetRole, onRemove }: MemberRowProps) {
  const t = useT();
  const styles = useMembersStyles();
  const s = t.members.list;
  const name = member.displayName.trim() || s.noName;
  const toManager = member.role === 'player';
  return (
    <View style={styles.row} testID={`member-${member.userId}`}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{member.isMe ? `${name} ${s.you}` : name}</Text>
        <Text style={styles.rowDetail}>{t.members.roles[member.role]}</Text>
      </View>
      {canManage ? (
        <View style={styles.actions}>
          <Button
            label={toManager ? s.makeManager : s.makePlayer}
            accessibilityLabel={toManager ? s.makeManagerLabel(name) : s.makePlayerLabel(name)}
            onPress={() => onSetRole(member, toManager ? 'manager' : 'player')}
            variant="secondary"
            compact
            disabled={disabled}
            testID={`member-role-${member.userId}`}
          />
          <Button
            label={s.remove}
            accessibilityLabel={s.removeLabel(name)}
            onPress={() => onRemove(member)}
            variant="danger"
            compact
            disabled={disabled}
            testID={`member-remove-${member.userId}`}
          />
        </View>
      ) : null}
    </View>
  );
}
