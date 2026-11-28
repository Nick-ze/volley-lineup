import { Text, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  useConfirm,
  useFormStyles,
  useListStyles,
} from '@/components';
import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore, useHostedTournaments } from '@/store';
import { makeStyles, spacing } from '@/theme';

import { TournamentRow } from './TournamentRow';

export interface TournamentListProps {
  profileId: string;
  onNew: () => void;
  onOpen: (tournament: HostedTournament) => void;
  onEdit: (tournament: HostedTournament) => void;
}

/**
 * The profile's hosted tournaments: "New tournament" (the tab's one orange action), the rows
 * (open, edit, delete with confirmation) and the note on where a tournament of your own team is
 * created.
 */
export function TournamentList({ profileId, onNew, onOpen, onEdit }: TournamentListProps) {
  const listStyles = useListStyles();
  const formStyles = useFormStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.list;
  const tournaments = useHostedTournaments(profileId);
  const { ask, dialogProps } = useConfirm();

  return (
    <>
      <Button label={s.new} onPress={onNew} testID="tournament-new" />
      {tournaments.length === 0 ? (
        <EmptyState testID="tournaments-empty">{s.empty}</EmptyState>
      ) : null}
      <View style={listStyles.list} testID="tournament-list">
        {tournaments.map((tournament) => (
          <TournamentRow
            key={tournament.id}
            tournament={tournament}
            onOpen={() => onOpen(tournament)}
            onEdit={() => onEdit(tournament)}
            onDelete={(teams, results) =>
              ask(s.confirmDelete(tournament.name, teams, results), () =>
                useAppStore.getState().deleteHostedTournament(tournament.id),
              )
            }
          />
        ))}
      </View>
      <Text style={[formStyles.hint, styles.hint]}>{s.ownTeamHint}</Text>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}

const useStyles = makeStyles(() => ({
  hint: { paddingHorizontal: spacing.xs },
}));
