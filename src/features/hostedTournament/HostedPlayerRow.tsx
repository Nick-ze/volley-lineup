import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, IconButton, useFormStyles, useListStyles } from '@/components';
import {
  MAX_HOSTED_PLAYERS,
  playerRef,
  validateHostedPlayer,
  type HostedPlayerError,
} from '@/domain/hostedTournament';
import type { HostedPlayer, HostedPlayerLabel } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { makeStyles, spacing, touchTarget } from '@/theme';

import { PlayerFields } from './PlayerFields';
import { playerErrorText } from './tournamentText';

export interface HostedPlayerRowProps {
  player: HostedPlayer;
  /** How the team's players are named. */
  label: HostedPlayerLabel;
  onDelete: (ref: string) => void;
}

/**
 * One player of a hosted team: "#6" with the name beside it (or the name first when the team
 * goes by name); Edit inline, Delete (the list asks first).
 */
export function HostedPlayerRow({ player, label, onDelete }: HostedPlayerRowProps) {
  const formStyles = useFormStyles();
  const listStyles = useListStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.players;
  const ref = playerRef(player, label, s.numberText);
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<HostedPlayerError | undefined>();

  if (editing) {
    const save = () => {
      const store = useAppStore.getState();
      const result = validateHostedPlayer(
        { number, name },
        store.hostedPlayers,
        player.teamId,
        player.id,
      );
      if (!result.ok) return setError(result.error);
      store.updateHostedPlayer(player.id, result.value);
      setEditing(false);
    };
    return (
      <View style={formStyles.card} testID={`hosted-player-edit-${player.id}`}>
        <PlayerFields
          number={number}
          name={name}
          onNumber={(text) => {
            setNumber(text);
            setError(undefined);
          }}
          onName={(text) => {
            setName(text);
            setError(undefined);
          }}
          numberLabel={s.editNumber(ref.full)}
          nameLabel={s.editName(ref.full)}
          error={playerErrorText(t, error, MAX_HOSTED_PLAYERS)}
          onSubmit={save}
          autoFocus
          testID="hosted-player-edit"
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

  // What the team goes by first; the rest of what is known beside it.
  const rest = ref.full === ref.short ? '' : ref.full.replace(ref.short, '').trim();
  return (
    <View style={[listStyles.row, styles.row]} testID={`hosted-player-${player.id}`}>
      <View style={styles.text}>
        <Text style={listStyles.title} numberOfLines={1}>
          {ref.short}
        </Text>
        {rest !== '' ? (
          <Text style={[listStyles.subtitle, styles.rest]} numberOfLines={1}>
            {rest}
          </Text>
        ) : null}
      </View>
      <View style={listStyles.actions}>
        <IconButton
          icon="pencil"
          accessibilityLabel={s.editLabel(ref.full)}
          onPress={() => {
            setNumber(player.number === undefined ? '' : `${player.number}`);
            setName(player.name ?? '');
            setError(undefined);
            setEditing(true);
          }}
        />
        <IconButton
          icon="trash-outline"
          accessibilityLabel={s.deleteLabel(ref.full)}
          onPress={() => onDelete(ref.full)}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // One line: the text takes the room the two icon buttons leave.
  row: { flexWrap: 'nowrap', minHeight: touchTarget + spacing.sm, paddingLeft: spacing.lg },
  text: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  rest: { flexShrink: 1 },
}));
