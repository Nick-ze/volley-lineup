import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { Team } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore, useTeamsForProfile } from '@/store';

import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ConfirmDialog';
import { ListRow } from './ListRow';
import { listStyles as styles } from './styles';
import { TeamForm } from './TeamForm';

type Editing = { mode: 'create' } | { mode: 'edit'; id: string } | null;

/** The current profile's teams: create, edit (name/season), delete, open. */
export function TeamList({
  profileId,
  onOpen,
}: {
  profileId: string;
  onOpen: (team: Team) => void;
}) {
  const t = useT();
  const teams = useTeamsForProfile(profileId);
  const { addTeam, updateTeam, deleteTeam } = useAppStore.getState();
  const [editing, setEditing] = useState<Editing>(null);
  const { ask, dialogProps } = useConfirm();
  const s = t.roster.teams;

  return (
    <>
      {editing?.mode === 'create' ? (
        <TeamForm
          submitLabel={s.create}
          onCancel={() => setEditing(null)}
          onSubmit={(value) => {
            addTeam({ profileId, ...value });
            setEditing(null);
          }}
        />
      ) : (
        <Button label={s.new} onPress={() => setEditing({ mode: 'create' })} />
      )}

      {teams.length === 0 && <Text style={styles.empty}>{s.empty}</Text>}

      <View style={styles.list}>
        {teams.map((team) =>
          editing?.mode === 'edit' && editing.id === team.id ? (
            <TeamForm
              key={team.id}
              initial={team}
              submitLabel={t.common.save}
              onCancel={() => setEditing(null)}
              onSubmit={(value) => {
                updateTeam(team.id, value);
                setEditing(null);
              }}
            />
          ) : (
            <ListRow
              key={team.id}
              title={team.name}
              onPress={() => onOpen(team)}
              accessibilityLabel={s.open(team.name)}
              actions={
                <>
                  <Button
                    label={t.common.edit}
                    accessibilityLabel={s.rename(team.name)}
                    variant="ghost"
                    compact
                    onPress={() => setEditing({ mode: 'edit', id: team.id })}
                  />
                  <Button
                    label={t.common.delete}
                    accessibilityLabel={s.delete(team.name)}
                    variant="danger"
                    compact
                    onPress={() =>
                      ask(t.roster.confirm.deleteTeam(team.name), () => deleteTeam(team.id))
                    }
                  />
                </>
              }
            />
          ),
        )}
      </View>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
