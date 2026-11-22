import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';

import type { Theme } from './theme';

const cache = new Map<Theme, NavigationTheme>();

/**
 * v8: the React Navigation theme (headers, tab bar, screen backgrounds) for the app theme:
 * React Navigation's dark or light base with our colours, and the dyslexia font for the
 * header titles and tab labels when it is on. Built once per theme.
 */
export function navigationTheme(theme: Theme): NavigationTheme {
  const cached = cache.get(theme);
  if (cached !== undefined) return cached;
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const { regular, bold } = theme.fonts;
  const fonts =
    regular === undefined || bold === undefined
      ? base.fonts
      : {
          regular: { fontFamily: regular, fontWeight: '400' as const },
          medium: { fontFamily: regular, fontWeight: '400' as const },
          bold: { fontFamily: bold, fontWeight: '400' as const },
          heavy: { fontFamily: bold, fontWeight: '400' as const },
        };
  const { colors } = theme;
  const result: NavigationTheme = {
    ...base,
    fonts,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.highlight,
    },
  };
  cache.set(theme, result);
  return result;
}
