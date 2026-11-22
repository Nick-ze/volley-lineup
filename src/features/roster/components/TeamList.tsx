import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, TeamAvatar } from '@/components';
import type { Team } from '@/domain/types';
import { applyPhotoDraft } from '@/features/photos/photoDraft';
import { useT } from '@/i18n';
import { useAppStore, useTeamsForProfile } from '@/store';

import { useConfirm } from '../hooks/useConfirm';
import { ConfirmDialog } from './ConfirmDialog';
import { ListRow } from './ListRow';
import { useListStyles } from './styles';
import { TeamForm } from './TeamForm';

type Editing = { mode: 'create' } | { mode: 'edit'; id: string } | null;

/** The current profile's teams: create, edit (name, v8: picture), delete, open. */
export function TeamList({
  profileId,
  onOpen,
}: {
  profileId: string;
  onOpen: (team: Team) => void;
}) {
  const styles = useListStyles();
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
          onSubmit={(value, photo) => {
            const team = addTeam({ profileId, ...value });
            // The photo is stored before the team points at it (photo store prune).
            void applyPhotoDraft(photo, (photoId) => updateTeam(team.id, { photoId }));
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
              team={team}
              submitLabel={t.common.save}
              onCancel={() => setEditing(null)}
              onSubmit={(value, photo) => {
                updateTeam(team.id, value);
                void applyPhotoDraft(photo, (photoId) => updateTeam(team.id, { photoId }));
                setEditing(null);
              }}
            />
          ) : (
            <ListRow
              key={team.id}
              title={team.name}
              leading={<TeamAvatar team={team} />}
              testID={`team-${team.id}`}
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
