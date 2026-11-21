import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HeaderBack } from '@/components/HeaderBack';
import { useT } from '@/i18n';
import { parentRoute } from '@/lib/parentRoute';
import { useAppStore } from '@/store';
import { colors } from '@/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.highlight,
  },
};

const teamIdOfMatch = (matchId: string) =>
  useAppStore.getState().matches.find((m) => m.id === matchId)?.teamId;

export default function RootLayout() {
  const t = useT();
  const hydrated = useAppStore((s) => s.hydrated);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          {hydrated ? (
            <Stack
              screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                contentStyle: { backgroundColor: colors.background },
                headerLeft:
                  route.name === 'index'
                    ? undefined
                    : () => (
                        <HeaderBack
                          fallback={parentRoute(
                            route.name,
                            route.params as Record<string, unknown> | undefined,
                            teamIdOfMatch,
                          )}
                        />
                      ),
              })}
            >
              <Stack.Screen name="index" options={{ title: t.nav.profiles }} />
              <Stack.Screen name="teams" options={{ title: t.nav.teams }} />
              <Stack.Screen name="team/[teamId]/index" options={{ title: t.nav.team }} />
              <Stack.Screen
                name="team/[teamId]/player"
                options={{ title: t.nav.player, presentation: 'modal' }}
              />
              <Stack.Screen
                name="team/[teamId]/match-new"
                options={{ title: t.nav.newMatch, presentation: 'modal' }}
              />
              <Stack.Screen name="match/[matchId]/index" options={{ title: t.nav.match }} />
              <Stack.Screen name="match/[matchId]/rotation" options={{ title: t.nav.rotation }} />
              <Stack.Screen name="match/[matchId]/starters" options={{ title: t.nav.starters }} />
              <Stack.Screen name="match/[matchId]/live" options={{ title: t.nav.live }} />
              <Stack.Screen name="settings" options={{ title: t.nav.settings }} />
            </Stack>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} accessibilityLabel={t.common.loading} />
            </View>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
