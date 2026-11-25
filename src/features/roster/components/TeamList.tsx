import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button, ConfirmDialog, useConfirm, useListStyles } from '@/components';
import type { Team } from '@/domain/types';
import { applyPhotoDraft } from '@/features/photos/photoDraft';
import { SharedTeamDeleteDialog } from '@/features/sync/SharedTeamDeleteDialog';
import { useT } from '@/i18n';
import { useAppStore, useTeamsForProfile } from '@/store';
import { makeStyles, spacing } from '@/theme';

import { TeamForm } from './TeamForm';
import { TeamRow } from './TeamRow';

type Editing = { mode: 'create' } | { mode: 'edit'; id: string } | null;

/**
 * The current profile's teams: create, edit (name, v8: picture), delete, open. v10: `actions`
 * go beside "New team" (Join a team); a shared team's Delete offers this device / everyone.
 */
export function TeamList({
  profileId,
  onOpen,
  actions,
}: {
  profileId: string;
  onOpen: (team: Team) => void;
  actions?: ReactNode;
}) {
  const styles = useListStyles();
  const own = useStyles();
  const t = useT();
  const teams = useTeamsForProfile(profileId);
  const { addTeam, updateTeam, deleteTeam } = useAppStore.getState();
  const [editing, setEditing] = useState<Editing>(null);
  const [sharedDelete, setSharedDelete] = useState<Team | null>(null);
  const sharedRole = useAppStore((s) =>
    sharedDelete ? s.sync.teams[sharedDelete.id]?.role : undefined,
  );
  const { ask, dialogProps } = useConfirm();
  const s = t.roster.teams;

  const onDelete = (team: Team) => {
    if (useAppStore.getState().sync.teams[team.id]) setSharedDelete(team);
    else ask(t.roster.confirm.deleteTeam(team.name), () => deleteTeam(team.id));
  };

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
        <View style={own.actions}>
          <Button label={s.new} onPress={() => setEditing({ mode: 'create' })} style={own.grow} />
          {actions}
        </View>
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
            <TeamRow
              key={team.id}
              team={team}
              onOpen={() => onOpen(team)}
              onEdit={() => setEditing({ mode: 'edit', id: team.id })}
              onDelete={() => onDelete(team)}
            />
          ),
        )}
      </View>
      <ConfirmDialog {...dialogProps} />
      {sharedDelete && sharedRole ? (
        <SharedTeamDeleteDialog
          team={sharedDelete}
          role={sharedRole}
          onClose={() => setSharedDelete(null)}
        />
      ) : null}
    </>
  );
}

const useStyles = makeStyles(() => ({
  // "New team" and (v10) "Join a team" side by side; they wrap on a narrow screen.
  // Alone, "New team" stays as wide as the list (as before v10).
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1 },
}));
