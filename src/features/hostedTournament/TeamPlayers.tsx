import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  useConfirm,
  useFormStyles,
  useListStyles,
  useTrackStyles,
} from '@/components';
import {
  MAX_HOSTED_PLAYERS,
  playerLabelOf,
  validateHostedPlayer,
  type HostedPlayerError,
} from '@/domain/hostedTournament';
import { HOSTED_PLAYER_LABELS, type HostedPlayerLabel, type HostedTeam } from '@/domain/types';
import { Segmented } from '@/features/lineup/Segmented';
import { useT } from '@/i18n';
import { useAppStore, useHostedPlayers } from '@/store';
import { makeStyles, spacing } from '@/theme';

import { HostedPlayerRow } from './HostedPlayerRow';
import { PlayerFields } from './PlayerFields';
import { playerErrorText } from './tournamentText';

/**
 * v12.2: a hosted team's optional players — whether they are shown by number or by name, a
 * number and a name field with "Add", and the players with Edit and Delete. A team without
 * players is scored as a team.
 */
export function TeamPlayers({ team }: { team: HostedTeam }) {
  const formStyles = useFormStyles();
  const listStyles = useListStyles();
  const track = useTrackStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.players;
  const players = useHostedPlayers(team.id);
  const label = playerLabelOf(team);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<HostedPlayerError | undefined>();
  const { ask, dialogProps } = useConfirm();

  const add = () => {
    const store = useAppStore.getState();
    const result = validateHostedPlayer({ number, name }, store.hostedPlayers, team.id);
    if (!result.ok) return setError(result.error);
    store.addHostedPlayer(team.id, result.value);
    setNumber('');
    setName('');
    setError(undefined);
  };

  return (
    <View style={styles.wrap} testID="team-players">
      <Text style={listStyles.heading} accessibilityRole="header">
        {s.title}
      </Text>
      <Text style={formStyles.hint}>{s.hint}</Text>
      <View style={formStyles.card}>
        <Text style={formStyles.sectionLabel}>{s.shownBy}</Text>
        <Segmented<HostedPlayerLabel>
          groupLabel={s.shownBy}
          style={track.trackOnPanel}
          value={label}
          onChange={(next) => useAppStore.getState().setHostedPlayerLabel(team.id, next)}
          options={HOSTED_PLAYER_LABELS.map((kind) => ({
            value: kind,
            text: s.label[kind],
            label: s.labelOption[kind],
            testID: `player-label-${kind}`,
          }))}
        />
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
          numberLabel={s.number}
          nameLabel={s.name}
          numberPlaceholder={s.numberPlaceholder}
          namePlaceholder={s.namePlaceholder}
          error={playerErrorText(t, error, MAX_HOSTED_PLAYERS)}
          onSubmit={add}
          testID="hosted-player"
        />
        <View style={formStyles.actions}>
          <Button
            label={s.add}
            accessibilityLabel={s.addLabel}
            variant="secondary"
            compact
            onPress={add}
            testID="hosted-player-add"
          />
        </View>
      </View>
      <Text style={formStyles.eyebrow} testID="hosted-player-count">
        {players.length === 0 ? s.empty : s.count(players.length, MAX_HOSTED_PLAYERS)}
      </Text>
      <View style={listStyles.list} testID="hosted-player-list">
        {players.map((player) => (
          <HostedPlayerRow
            key={player.id}
            player={player}
            label={label}
            onDelete={(ref) =>
              ask(s.confirmDelete(ref), () => useAppStore.getState().deleteHostedPlayer(player.id))
            }
          />
        ))}
      </View>
      <ConfirmDialog {...dialogProps} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.md },
}));
