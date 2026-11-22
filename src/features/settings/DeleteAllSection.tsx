import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { Section } from './Section';
import { StatusMessage } from './StatusMessage';

/**
 * Delete all data, with an in-app confirmation (`Alert.alert` does nothing on web).
 * `onDeleted` lets the screen clear other sections' messages (e.g. a finished export).
 */
export function DeleteAllSection({ onDeleted }: { onDeleted?: () => void }) {
  const styles = useStyles();
  const t = useT();
  const resetAll = useAppStore((s) => s.resetAll);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const deleteAll = () => {
    resetAll();
    setConfirming(false);
    setDone(true);
    onDeleted?.();
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

const useStyles = makeStyles((theme) => ({
  confirm: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.surfaceRaised,
  },
  confirmTitle: { ...typography.subheading, color: theme.colors.text },
  body: { ...typography.body, color: theme.colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
