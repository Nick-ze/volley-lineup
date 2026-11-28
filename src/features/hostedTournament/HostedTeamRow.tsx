import { useState } from 'react';
import { View } from 'react-native';

import { Button, IconButton, ListRow, TextField, useFormStyles, useListStyles } from '@/components';
import {
  MAX_HOSTED_TEAM_NAME_LENGTH,
  MAX_HOSTED_TEAMS,
  validateHostedTeamName,
  type HostedTeamNameError,
} from '@/domain/hostedTournament';
import type { HostedTeam } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';

import { teamNameErrorText } from './tournamentText';

export interface HostedTeamRowProps {
  team: HostedTeam;
  /** Tapping the row shows the team's matches. */
  onOpen: () => void;
  onDelete: () => void;
}

/**
 * One team of a hosted tournament: its name (tap: its matches); Rename inline, Delete (the list
 * asks first).
 */
export function HostedTeamRow({ team, onOpen, onDelete }: HostedTeamRowProps) {
  const formStyles = useFormStyles();
  const listStyles = useListStyles();
  const t = useT();
  const s = t.tournament.teams;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [error, setError] = useState<HostedTeamNameError | undefined>();

  if (editing) {
    const save = () => {
      const store = useAppStore.getState();
      const result = validateHostedTeamName(name, store.hostedTeams, team.tournamentId, team.id);
      if (!result.ok) return setError(result.error);
      store.renameHostedTeam(team.id, result.name);
      setEditing(false);
    };
    return (
      <View style={formStyles.card} testID={`hosted-team-edit-${team.id}`}>
        <TextField
          label={s.newName(team.name)}
          maxLength={MAX_HOSTED_TEAM_NAME_LENGTH}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(undefined);
          }}
          error={teamNameErrorText(t, error, MAX_HOSTED_TEAMS)}
          onSubmitEditing={save}
          autoFocus
          testID="hosted-team-rename"
        />
        <View style={formStyles.actions}>
          <Button
            label={t.common.cancel}
            variant="secondary"
            compact
            onPress={() => setEditing(false)}
          />
          <Button label={t.common.save} compact onPress={save} />
        </View>
      </View>
    );
  }
  return (
    <ListRow
      title={team.name}
      onPress={onOpen}
      accessibilityLabel={s.open(team.name)}
      testID={`hosted-team-${team.id}`}
      actions={
        <View style={listStyles.actions}>
          <IconButton
            icon="pencil"
            accessibilityLabel={s.renameLabel(team.name)}
            onPress={() => {
              setName(team.name);
              setError(undefined);
              setEditing(true);
            }}
          />
          <IconButton
            icon="trash-outline"
            accessibilityLabel={s.deleteLabel(team.name)}
            onPress={onDelete}
          />
        </View>
      }
    />
  );
}
