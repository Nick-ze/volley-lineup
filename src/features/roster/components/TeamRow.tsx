import { Text } from 'react-native';

import { IconButton, ListRow, TeamAvatar, useListStyles } from '@/components';
import type { Team } from '@/domain/types';
import { useT } from '@/i18n';
import { usePlayersForTeam, useTeamAccess } from '@/store';

export interface TeamRowProps {
  team: Team;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** v11: size of the team's picture in its row. */
const ROW_AVATAR = 52;

/**
 * One team of the Teams tab: open, Edit (name, picture), Delete (v11: two icon buttons in the
 * row). Under the name: the number of players, or for a shared team (v10) that it is shared
 * ("Shared", plus "View only" for the player role). View-only members get no Edit.
 */
export function TeamRow({ team, onOpen, onEdit, onDelete }: TeamRowProps) {
  const styles = useListStyles();
  const t = useT();
  const s = t.roster.teams;
  const access = useTeamAccess(team.id);
  const playerCount = usePlayersForTeam(team.id).length;
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
        ) : (
          t.roster.team.playerCount(playerCount)
        )
      }
      leading={<TeamAvatar team={team} size={ROW_AVATAR} />}
      testID={`team-${team.id}`}
      onPress={onOpen}
      accessibilityLabel={mark ? t.sync.team.rowLabel(s.open(team.name), mark) : s.open(team.name)}
      actions={
        <>
          {access.canEdit ? (
            <IconButton icon="pencil" accessibilityLabel={s.rename(team.name)} onPress={onEdit} />
          ) : null}
          <IconButton
            icon="trash-outline"
            accessibilityLabel={s.delete(team.name)}
            onPress={onDelete}
          />
        </>
      }
    />
  );
}
