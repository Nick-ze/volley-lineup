import { Text } from 'react-native';

import { Button, ListRow, TeamAvatar, useListStyles } from '@/components';
import type { Team } from '@/domain/types';
import { useT } from '@/i18n';
import { useTeamAccess } from '@/store';

export interface TeamRowProps {
  team: Team;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One team of the Teams tab: open, Edit (name, picture), Delete. v10: a shared team says so
 * ("Shared", plus "View only" for the player role), and view-only members get no Edit.
 */
export function TeamRow({ team, onOpen, onEdit, onDelete }: TeamRowProps) {
  const styles = useListStyles();
  const t = useT();
  const s = t.roster.teams;
  const access = useTeamAccess(team.id);
  const mark = access.shared
    ? access.canEdit
      ? t.sync.shared
      : `${t.sync.shared}${t.sync.team.markSeparator}${t.sync.viewOnly}`
    : null;
  return (
    <ListRow
      title={team.name}
      subtitle={
        mark ? (
          <Text style={styles.subtitle} numberOfLines={1} testID={`team-${team.id}-shared`}>
            {mark}
          </Text>
        ) : undefined
      }
      leading={<TeamAvatar team={team} />}
      testID={`team-${team.id}`}
      onPress={onOpen}
      accessibilityLabel={mark ? t.sync.team.rowLabel(s.open(team.name), mark) : s.open(team.name)}
      actions={
        <>
          {access.canEdit ? (
            <Button
              label={t.common.edit}
              accessibilityLabel={s.rename(team.name)}
              variant="ghost"
              compact
              onPress={onEdit}
            />
          ) : null}
          <Button
            label={t.common.delete}
            accessibilityLabel={s.delete(team.name)}
            variant="danger"
            compact
            onPress={onDelete}
          />
        </>
      }
    />
  );
}
