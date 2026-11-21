import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components';
import { useT } from '@/i18n';
import { colors, typography } from '@/theme';

import { DeleteAllSection } from './DeleteAllSection';
import { DisplaySection } from './DisplaySection';
import { ExportSection } from './ExportSection';
import { ImportSection } from './ImportSection';
import { LanguageSection } from './LanguageSection';
import { Section } from './Section';

/** Settings tab: language, player chips, export, import, delete all data, app version. */
export function SettingsScreen() {
  const t = useT();
  const version = Constants.expoConfig?.version ?? t.transfer.about.unknownVersion;
  // Bumped by "Delete all data": remounts export / import so their old messages disappear.
  const [generation, setGeneration] = useState(0);
  return (
    <Screen testID="settings-screen">
      <LanguageSection />
      <DisplaySection />
      <ExportSection key={`export-${generation}`} />
      <ImportSection key={`import-${generation}`} />
      <DeleteAllSection onDeleted={() => setGeneration((g) => g + 1)} />
      <Section title={t.transfer.about.title}>
        <Text style={styles.version}>
          {t.app.name} · {t.transfer.about.version(version)}
        </Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  version: { ...typography.body, color: colors.textMuted },
});
