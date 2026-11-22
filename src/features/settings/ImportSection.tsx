import { Text, View } from 'react-native';

import { Button } from '@/components';
import { useT, type Strings } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { Section } from './Section';
import { StatusMessage, type Status } from './StatusMessage';
import { useImport, type ImportState } from './useImport';

function statusOf(t: Strings, state: ImportState): Status | null {
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
  const styles = useStyles();
  const t = useT();
  const { state, pick, apply, cancel } = useImport();

  return (
    <Section title={t.transfer.import.title} hint={t.transfer.import.hint}>
      {state.step === 'preview' ? (
        <View style={styles.preview} testID="import-preview">
          <Text style={styles.previewTitle}>{t.transfer.import.previewTitle(state.fileName)}</Text>
          <Text style={styles.summary}>{t.transfer.import.summary(state.summary)}</Text>
          {state.summary.descriptions > 0 ? (
            <Text style={styles.muted} testID="import-descriptions">
              {t.transfer.import.descriptions(state.summary.descriptions)}
            </Text>
          ) : null}
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
      <StatusMessage status={statusOf(t, state)} testID="import-status" />
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
  preview: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: theme.colors.surfaceRaised,
  },
  previewTitle: { ...typography.label, color: theme.colors.textMuted },
  summary: { ...typography.subheading, color: theme.colors.text },
  muted: { ...typography.body, color: theme.colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
}));
