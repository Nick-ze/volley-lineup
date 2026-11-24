import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HeaderBack } from '@/components/HeaderBack';
import { HeaderTitle } from '@/components/HeaderTitle';
import { TourHost } from '@/features/tour';
import { useT } from '@/i18n';
import { setDocumentLanguage } from '@/lib/documentLanguage';
import { useAppFonts } from '@/lib/fonts';
import { parentRoute } from '@/lib/parentRoute';
import { setThemeColor } from '@/lib/themeColor';
import { useAppStore } from '@/store';
import { makeStyles, ThemeProvider as AppThemeProvider, useTheme } from '@/theme';
import { navigationTheme } from '@/theme/navigationTheme';

const teamIdOfMatch = (matchId: string) =>
  useAppStore.getState().matches.find((m) => m.id === matchId)?.teamId;
const seasonIdOfMatch = (matchId: string) =>
  useAppStore.getState().matches.find((m) => m.id === matchId)?.seasonId;

export default function RootLayout() {
  const language = useAppStore((s) => s.language);
  const themeMode = useAppStore((s) => s.themeMode);
  const dyslexiaFont = useAppStore((s) => s.dyslexiaFont);
  useEffect(() => setDocumentLanguage(language), [language]);

  // The theme provider wraps everything that reads the theme (`ThemedRoot` and below).
  return (
    <GestureHandlerRootView style={rootStyles.root}>
      <AppThemeProvider mode={themeMode} dyslexiaFont={dyslexiaFont}>
        <ThemedRoot />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

function ThemedRoot() {
  const theme = useTheme();
  const { colors } = theme;
  const styles = useStyles();
  const t = useT();
  const hydrated = useAppStore((s) => s.hydrated);
  // v8: the bundled dyslexia font loads in the background; only with the font on does the
  // spinner wait for it (until loaded, failed or timed out — never forever).
  const fontsReady = useAppFonts();
  const ready = hydrated && (!theme.dyslexiaFont || fontsReady);
  // v8 QA: the browser bar (web `<meta name="theme-color">`) follows light / dark.
  useEffect(() => setThemeColor(colors.background), [colors.background]);

  return (
    <SafeAreaProvider style={styles.root}>
      <ThemeProvider value={navigationTheme(theme)}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        {ready ? (
          <>
            <Stack
              screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerTitle: ({ children }) => <HeaderTitle>{children}</HeaderTitle>,
                contentStyle: { backgroundColor: colors.background },
                // The picker and the tabs (headerShown: false) never get a back button.
                headerLeft:
                  route.name === 'index' || route.name === '(tabs)'
                    ? undefined
                    : () => (
                        <HeaderBack
                          fallback={parentRoute(
                            route.name,
                            route.params as Record<string, unknown> | undefined,
                            teamIdOfMatch,
                            seasonIdOfMatch,
                          )}
                        />
                      ),
              })}
            >
              <Stack.Screen name="index" options={{ title: t.nav.profiles }} />
              {/* Teams / Profile / Settings: bottom tabs with their own headers. */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t.nav.teams }} />
              <Stack.Screen name="team/[teamId]/index" options={{ title: t.nav.team }} />
              <Stack.Screen
                name="team/[teamId]/player"
                options={{ title: t.nav.player, presentation: 'modal' }}
              />
              <Stack.Screen
                name="team/[teamId]/match-new"
                options={{ title: t.nav.newMatch, presentation: 'modal' }}
              />
              <Stack.Screen
                name="team/[teamId]/preset/[presetId]"
                options={{ title: t.nav.preset }}
              />
              <Stack.Screen name="team/[teamId]/starters" options={{ title: t.nav.teamStarters }} />
              <Stack.Screen
                name="team/[teamId]/season/[seasonId]"
                options={{ title: t.nav.season }}
              />
              <Stack.Screen
                name="team/[teamId]/season-new"
                options={{ title: t.nav.newSeason, presentation: 'modal' }}
              />
              <Stack.Screen
                name="team/[teamId]/players/[playerId]"
                options={{ title: t.nav.playerDetail }}
              />
              <Stack.Screen name="match/[matchId]/index" options={{ title: t.nav.match }} />
              <Stack.Screen name="match/[matchId]/rotation" options={{ title: t.nav.rotation }} />
              <Stack.Screen name="match/[matchId]/starters" options={{ title: t.nav.starters }} />
              <Stack.Screen name="match/[matchId]/live" options={{ title: t.nav.live }} />
              <Stack.Screen name="match/[matchId]/stats" options={{ title: t.nav.matchStats }} />
              <Stack.Screen
                name="match/[matchId]/performance"
                options={{ title: t.nav.performance }}
              />
            </Stack>
            {/* v9.0: the tutorial's choice and tip popups, over every screen. */}
            <TourHost />
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primaryText} accessibilityLabel={t.common.loading} />
          </View>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const rootStyles = StyleSheet.create({ root: { flex: 1 } });

const useStyles = makeStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
}));
