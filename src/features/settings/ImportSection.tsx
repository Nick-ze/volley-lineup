import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { t } from '@/i18n/en';
import { colors, radius, spacing, typography } from '@/theme';

import { Section } from './Section';
import { StatusMessage, type Status } from './StatusMessage';
import { useImport, type ImportState } from './useImport';

function statusOf(state: ImportState): Status | null {
  if (state.step === 'error') return { tone: 'error', text: t.transfer.import.errors[state.error] };
  if (state.step === 'done') {
    const text =
      state.mode === 'merge' ? t.transfer.import.doneMerge : t.transfer.import.doneReplace;
    return { tone: 'success', text };
  }
  return null;
}

/** Import: pick a file, preview what's in it, then merge, replace or cancel. */
export function ImportSection() {
  const { state, pick, apply, cancel } = useImport();

  return (
    <Section title={t.transfer.import.title} hint={t.transfer.import.hint}>
      {state.step === 'preview' ? (
        <View style={styles.preview} testID="import-preview">
          <Text style={styles.previewTitle}>{t.transfer.import.previewTitle(state.fileName)}</Text>
          <Text style={styles.summary}>{t.transfer.import.summary(state.summary)}</Text>
          <Text style={styles.muted}>{t.transfer.import.mergeHint}</Text>
          <Text style={styles.muted}>{t.transfer.import.replaceHint}</Text>
          <View style={styles.actions}>
            <Button label={t.transfer.import.merge} onPress={() => apply('merge')} />
            <Button
              label={t.transfer.import.replace}
              variant="danger"
              onPress={() => apply('replace')}
            />
            <Button label={t.transfer.import.cancel} variant="ghost" onPress={cancel} />
          </View>
        </View>
      ) : (
        <Button label={t.transfer.import.pick} onPress={pick} testID="import-pick" />
      )}
      <StatusMessage status={statusOf(state)} testID="import-status" />
    </Section>
  );
}

const styles = StyleSheet.create({
  preview: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  previewTitle: { ...typography.label, color: colors.textMuted },
  summary: { ...typography.subheading, color: colors.text },
  muted: { ...typography.body, color: colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
