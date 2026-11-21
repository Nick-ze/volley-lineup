import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { colors, dialogMaxWidth, radius, spacing, typography } from '@/theme';

export interface PrintChoiceDialogProps {
  /** Called with the choice: `true` prints with the results section. */
  onChoose: (withResults: boolean) => void;
  onCancel: () => void;
}

/** In-app dialog "Lineups only" / "With results" (Alert.alert does nothing on web). Mount to show. */
export function PrintChoiceDialog({ onChoose, onCancel }: PrintChoiceDialogProps) {
  const t = useT();
  const s = t.print.choice;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal testID="print-choice">
          <Text style={styles.title} accessibilityRole="header">
            {s.title}
          </Text>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: dialogMaxWidth,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.subheading, color: colors.text },
  body: { ...typography.body, color: colors.textMuted },
  actions: { gap: spacing.sm },
});
