import { Text, View } from 'react-native';

import { Button, Dialog } from '@/components';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

/** What to print: the lineup sheet (with / without results) or the player list for the scorer. */
export type PrintChoice = 'lineups' | 'results' | 'scorer';

export interface PrintChoiceDialogProps {
  /** v3: the match has results — offers "With results" and "Lineups only". */
  hasResults: boolean;
  onChoose: (choice: PrintChoice) => void;
  onCancel: () => void;
}

/**
 * In-app dialog (Alert.alert does nothing on web). Mount to show. With results: "With results" /
 * "Lineups only"; before: "Lineup sheet". v9.2: always also "Player list for the scorer".
 */
export function PrintChoiceDialog({ hasResults, onChoose, onCancel }: PrintChoiceDialogProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.print.choice;
  return (
    <Dialog
      onClose={onCancel}
      title={s.title}
      testID="print-choice"
      cardProps={{
        role: 'dialog',
        'aria-modal': true,
        accessibilityLabel: s.title,
        'aria-label': s.title,
      }}
    >
      <Text style={styles.body}>{hasResults ? s.body : s.bodyNoResults}</Text>
      <View style={styles.actions}>
        {hasResults ? (
          <>
            <Button
              label={s.withResults}
              accessibilityLabel={s.withResultsLabel}
              onPress={() => onChoose('results')}
              testID="print-with-results"
            />
            <Button
              label={s.lineupsOnly}
              accessibilityLabel={s.lineupsOnlyLabel}
              variant="secondary"
              onPress={() => onChoose('lineups')}
              testID="print-lineups-only"
            />
          </>
        ) : (
          <Button
            label={s.lineupSheet}
            accessibilityLabel={s.lineupSheetLabel}
            onPress={() => onChoose('lineups')}
            testID="print-lineup-sheet"
          />
        )}
        <Button
          label={s.scorer}
          accessibilityLabel={s.scorerLabel}
          variant="secondary"
          onPress={() => onChoose('scorer')}
          testID="print-scorer"
        />
        <Button
          label={s.cancel}
          accessibilityLabel={s.cancelLabel}
          variant="ghost"
          onPress={onCancel}
          testID="print-cancel"
        />
      </View>
    </Dialog>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...typography.body, color: theme.colors.textMuted },
  // The choices stacked, each as wide as the card.
  actions: { gap: spacing.sm },
}));
