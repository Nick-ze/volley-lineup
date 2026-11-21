import Constants from 'expo-constants';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components';
import { useT } from '@/i18n';
import { colors, typography } from '@/theme';

import { DeleteAllSection } from './DeleteAllSection';
import { ExportSection } from './ExportSection';
import { ImportSection } from './ImportSection';
import { LanguageSection } from './LanguageSection';
import { Section } from './Section';

/** Settings tab: language, export, import, delete all data, app version. */
export function SettingsScreen() {
  const t = useT();
  const version = Constants.expoConfig?.version ?? t.transfer.about.unknownVersion;
  return (
    <Screen testID="settings-screen">
      <LanguageSection />
      <ExportSection />
      <ImportSection />
      <DeleteAllSection />
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
