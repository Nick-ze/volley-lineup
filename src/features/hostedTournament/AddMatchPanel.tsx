import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ChoiceChip, useFormStyles } from '@/components';
import { addMatchError, MAX_MANUAL_MATCHES } from '@/domain/hostedTournament';
import type { HostedTeam, HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { makeStyles, spacing, typography } from '@/theme';

export interface AddMatchPanelProps {
  tournament: HostedTournament;
  teams: readonly HostedTeam[];
}

/**
 * v12.1, a tournament with own matches: choose two teams (chips that wrap, so sixteen teams need
 * no sideways scrolling) and add their match. The team tapped first is the upper one. The same
 * two teams can be added again.
 */
export function AddMatchPanel({ tournament, teams }: AddMatchPanelProps) {
  const formStyles = useFormStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.matches;
  const [chosen, setChosen] = useState<string[]>([]);
  const [tooMany, setTooMany] = useState(false);
  // A team removed meanwhile is no longer chosen.
  const pair = chosen.filter((id) => teams.some((team) => team.id === id));
  const name = (id: string) => teams.find((team) => team.id === id)?.name ?? '';

  const toggle = (id: string) => {
    setTooMany(false);
    setChosen(
      pair.includes(id)
        ? pair.filter((x) => x !== id)
        : // A third team takes the second one's place.
          [...pair.slice(0, 1), id],
    );
  };

  const add = () => {
    if (pair.length !== 2) return;
    const store = useAppStore.getState();
    const error = addMatchError(
      tournament,
      pair[0],
      pair[1],
      store.hostedTeams,
      store.hostedResults,
    );
    if (error) return setTooMany(error === 'TOO_MANY');
    store.addHostedMatch(tournament.id, pair[0], pair[1]);
    setChosen([]);
  };

  return (
    <View style={formStyles.card} testID="add-match">
      <Text style={formStyles.sectionLabel}>{s.choose}</Text>
      <View style={styles.chips} accessibilityRole="none" accessibilityLabel={s.choose}>
        {teams.map((team) => (
          <ChoiceChip
            key={team.id}
            label={team.name}
            selected={pair.includes(team.id)}
            onPress={() => toggle(team.id)}
            style={styles.chip}
            testID={`add-match-team-${team.id}`}
          />
        ))}
      </View>
      {pair.length === 2 ? (
        <Text style={styles.pair} testID="add-match-pair">
          {s.chosen(name(pair[0]), name(pair[1]))}
        </Text>
      ) : null}
      {tooMany ? (
        <Text style={styles.error} accessibilityRole="alert" testID="add-match-error">
          {s.tooMany(MAX_MANUAL_MATCHES)}
        </Text>
      ) : null}
      <View style={formStyles.actions}>
        <Button
          label={s.add}
          compact
          disabled={pair.length !== 2}
          onPress={add}
          testID="add-match-button"
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // On a panel the chips are a tone darker than the panel; a long name may shrink to the row.
  chip: { maxWidth: '100%', backgroundColor: theme.colors.background },
  pair: { ...typography.body, fontWeight: '700', color: theme.colors.text },
  error: { ...typography.label, color: theme.colors.error },
}));
