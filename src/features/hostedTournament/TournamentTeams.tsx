import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  TextField,
  useConfirm,
  useFormStyles,
  useListStyles,
} from '@/components';
import {
  MAX_HOSTED_TEAM_NAME_LENGTH,
  MAX_HOSTED_TEAMS,
  resultCountOfTeam,
  validateHostedTeamName,
  type HostedTeamNameError,
} from '@/domain/hostedTournament';
import type { HostedPlanKind } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore, useHostedResults, useHostedTeams } from '@/store';
import { spacing } from '@/theme';

import { HostedTeamRow } from './HostedTeamRow';
import { teamNameErrorText } from './tournamentText';

/**
 * A hosted tournament's teams: a name field with "Add" (this tab's one orange action), the teams
 * in the order they were added with Rename and Delete, how many of 16 there are, and the note
 * that the plan follows the teams. Removing a team with results asks and says how many go.
 */
export function TournamentTeams({
  tournamentId,
  plan,
  onOpenTeam,
}: {
  tournamentId: string;
  /** v12.1: with own matches the hint and the question speak of matches, not of the plan. */
  plan: HostedPlanKind;
  /** Tapping a team shows its matches. */
  onOpenTeam: (teamId: string) => void;
}) {
  const formStyles = useFormStyles();
  const listStyles = useListStyles();
  const t = useT();
  const s = t.tournament.teams;
  const teams = useHostedTeams(tournamentId);
  const results = useHostedResults(tournamentId);
  const [name, setName] = useState('');
  const [error, setError] = useState<HostedTeamNameError | undefined>();
  const { ask, dialogProps } = useConfirm();
  const confirmText = plan === 'manual' ? s.confirmDeleteManual : s.confirmDelete;

  const add = () => {
    const store = useAppStore.getState();
    const result = validateHostedTeamName(name, store.hostedTeams, tournamentId);
    if (!result.ok) return setError(result.error);
    store.addHostedTeam(tournamentId, result.name);
    setName('');
    setError(undefined);
  };

  return (
    <View style={tabStyles.wrap}>
      <View style={formStyles.card}>
        <TextField
          label={s.name}
          maxLength={MAX_HOSTED_TEAM_NAME_LENGTH}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(undefined);
          }}
          placeholder={s.namePlaceholder}
          error={teamNameErrorText(t, error, MAX_HOSTED_TEAMS)}
          onSubmitEditing={add}
          testID="hosted-team-name"
        />
        <View style={formStyles.actions}>
          <Button
            label={s.add}
            accessibilityLabel={s.addLabel}
            compact
            onPress={add}
            testID="hosted-team-add"
          />
        </View>
      </View>
      <Text style={formStyles.eyebrow} testID="hosted-team-count">
        {s.count(teams.length, MAX_HOSTED_TEAMS)}
      </Text>
      {teams.length === 0 ? <EmptyState>{s.empty}</EmptyState> : null}
      <View style={listStyles.list} testID="hosted-team-list">
        {teams.map((team) => (
          <HostedTeamRow
            key={team.id}
            team={team}
            onOpen={() => onOpenTeam(team.id)}
            onDelete={() =>
              ask(confirmText(team.name, resultCountOfTeam(results, team.id)), () =>
                useAppStore.getState().deleteHostedTeam(team.id),
              )
            }
          />
        ))}
      </View>
      <Text style={formStyles.hint}>{plan === 'manual' ? s.hintManual : s.hint}</Text>
      <ConfirmDialog {...dialogProps} />
    </View>
  );
}

// The tab's parts (form, count, list, hint) keep a clear distance from each other (#358).
const tabStyles = StyleSheet.create({ wrap: { gap: spacing.md } });
