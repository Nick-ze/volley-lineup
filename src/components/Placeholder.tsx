import { Text } from 'react-native';

import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

import { Screen } from './Screen';

/** Temporary content for screens that a feature task has not built yet. */
export function Placeholder({ title }: { title: string }) {
  const styles = useStyles();
  const t = useT();
  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{t.placeholder.comingSoon}</Text>
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  title: { ...typography.heading, color: theme.colors.text },
  body: { ...typography.body, color: theme.colors.textMuted },
}));
