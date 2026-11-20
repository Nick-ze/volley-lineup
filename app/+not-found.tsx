import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button, Screen } from '@/components';
import { t } from '@/i18n/en';
import { colors, typography } from '@/theme';

/** Shown for unknown URLs (e.g. a mistyped deep link). */
export default function NotFoundScreen() {
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

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.text },
});
