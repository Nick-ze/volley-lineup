import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { HostedTournament } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { useTournamentSheet } from './useTournamentSheet';

/**
 * v12.3: the Table tab's "Table (PDF)": the ranks with their points and every result on a page
 * to print or to save as a PDF, for reading the standings out at the end.
 */
export function TablePdfButton({ tournament }: { tournament: HostedTournament }) {
  const styles = useStyles();
  const t = useT();
  const { print, printing, failed } = useTournamentSheet(tournament);
  return (
    <View style={styles.wrap}>
      <Button
        label={t.tournament.sheet.button}
        accessibilityLabel={t.tournament.sheet.buttonLabel}
        variant="secondary"
        compact
        disabled={printing}
        onPress={() => void print()}
        style={styles.button}
        testID="table-pdf"
      />
      {failed ? (
        <Text accessibilityRole="alert" style={styles.error} testID="table-pdf-error">
          {t.print.failed}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  button: { alignSelf: 'flex-start' },
  error: { ...typography.body, color: theme.colors.error },
}));
