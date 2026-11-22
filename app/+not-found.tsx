import { Stack, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { Button, Screen } from '@/components';
import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

/** Shown for unknown URLs (e.g. a mistyped deep link). */
export default function NotFoundScreen() {
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  return (
    <Screen>
      <Stack.Screen options={{ title: t.common.notFound }} />
      <Text style={styles.title} accessibilityRole="header">
        {t.common.pageNotFound}
      </Text>
      <Button label={t.common.goHome} onPress={() => router.replace('/')} />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  title: { ...typography.heading, color: theme.colors.text },
}));
