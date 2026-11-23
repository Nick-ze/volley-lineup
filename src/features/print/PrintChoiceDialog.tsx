import { Text, View } from 'react-native';

import { Button, Dialog } from '@/components';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

export interface PrintChoiceDialogProps {
  /** Called with the choice: `true` prints with the results section. */
  onChoose: (withResults: boolean) => void;
  onCancel: () => void;
}

/** In-app dialog "Lineups only" / "With results" (Alert.alert does nothing on web). Mount to show. */
export function PrintChoiceDialog({ onChoose, onCancel }: PrintChoiceDialogProps) {
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
      <Text style={styles.body}>{s.body}</Text>
      <View style={styles.actions}>
        <Button
          label={s.withResults}
          accessibilityLabel={s.withResultsLabel}
          onPress={() => onChoose(true)}
          testID="print-with-results"
        />
        <Button
          label={s.lineupsOnly}
          accessibilityLabel={s.lineupsOnlyLabel}
          variant="secondary"
          onPress={() => onChoose(false)}
          testID="print-lineups-only"
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
  // The three choices stacked, each as wide as the card.
  actions: { gap: spacing.sm },
}));
