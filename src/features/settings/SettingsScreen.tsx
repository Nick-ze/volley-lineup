import Constants from 'expo-constants';
import { useState } from 'react';
import { Text } from 'react-native';

import { Screen } from '@/components';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

import { DeleteAllSection } from './DeleteAllSection';
import { DisplaySection } from './DisplaySection';
import { ExportSection } from './ExportSection';
import { ImportSection } from './ImportSection';
import { LanguageSection } from './LanguageSection';
import { Section } from './Section';

/** Settings tab: language, player chips, export, import, delete all data, app version. */
export function SettingsScreen() {
  const styles = useStyles();
  const t = useT();
  useTourPage('settings');
  const version = Constants.expoConfig?.version ?? t.transfer.about.unknownVersion;
  // Bumped by "Delete all data": remounts export / import so their old messages disappear.
  const [generation, setGeneration] = useState(0);
  return (
    <Screen testID="settings-screen" title={{ title: t.nav.settings }}>
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

const useStyles = makeStyles((theme) => ({
  version: { ...typography.body, color: theme.colors.textMuted },
}));
