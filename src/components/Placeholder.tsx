import { StyleSheet, Text } from 'react-native';

import { t } from '@/i18n/en';
import { colors, typography } from '@/theme';

import { Screen } from './Screen';

/** Temporary content for screens that a feature task has not built yet. */
export function Placeholder({ title }: { title: string }) {
  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{t.placeholder.comingSoon}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.textMuted },
});
