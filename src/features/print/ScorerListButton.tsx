import { Text, View } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { useScorerSheet } from './useScorerSheet';

/** v9.2: Roster tab button "Player list (PDF)": the active players and numbers for the scorer. */
export function ScorerListButton({ teamId }: { teamId: string }) {
  const styles = useStyles();
  const t = useT();
  const { print, printing, failed, ready } = useScorerSheet({ teamId });
  return (
    <View style={styles.wrap}>
      <Button
        label={t.print.scorer.rosterButton}
        accessibilityLabel={t.print.scorer.rosterButtonLabel}
        variant="secondary"
        compact
        disabled={!ready || printing}
        onPress={() => void print()}
        testID="print-scorer-list"
      />
      {failed ? (
        <Text accessibilityRole="alert" style={styles.error} testID="print-scorer-error">
          {t.print.failed}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  error: { ...typography.body, color: theme.colors.error },
}));
