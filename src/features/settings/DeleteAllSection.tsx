import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

import { Section } from './Section';
import { StatusMessage } from './StatusMessage';

/**
 * Delete all data, with an in-app confirmation (`Alert.alert` does nothing on web).
 */
export function DeleteAllSection() {
  const resetAll = useAppStore((s) => s.resetAll);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const deleteAll = () => {
    resetAll();
    setConfirming(false);
    setDone(true);
  };

  return (
    <Section title={t.transfer.danger.title} hint={t.transfer.danger.hint} tone="danger">
      {confirming ? (
        <View style={styles.confirm} accessibilityRole="alert" testID="delete-confirm">
          <Text style={styles.confirmTitle}>{t.transfer.danger.confirmTitle}</Text>
          <Text style={styles.body}>{t.transfer.danger.confirmBody}</Text>
          <View style={styles.actions}>
            <Button label={t.transfer.danger.confirm} variant="danger" onPress={deleteAll} />
            <Button
              label={t.transfer.danger.cancel}
              variant="secondary"
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      ) : (
        <Button
          label={t.transfer.danger.button}
          variant="danger"
          onPress={() => {
            setDone(false);
            setConfirming(true);
          }}
        />
      )}
      <StatusMessage status={done ? { tone: 'success', text: t.transfer.danger.done } : null} />
    </Section>
  );
}

const styles = StyleSheet.create({
  confirm: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.surfaceRaised,
  },
  confirmTitle: { ...typography.subheading, color: colors.text },
  body: { ...typography.body, color: colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
