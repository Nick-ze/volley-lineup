import { Text } from 'react-native';

import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

import { tournamentMetaParts } from './tournamentText';

/** The quiet line under a tournament's name: "05.12.26 · Halle Süd · best of 3". */
export function TournamentMeta({ tournament }: { tournament: HostedTournament }) {
  const styles = useStyles();
  const t = useT();
  return (
    <Text style={styles.meta} testID="tournament-meta">
      {tournamentMetaParts(t, tournament).join(t.tournament.metaSeparator)}
    </Text>
  );
}

const useStyles = makeStyles((theme) => ({
  meta: { ...typography.label, color: theme.colors.textMuted },
}));
