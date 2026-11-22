/**
 * v8: theme context (docs/PLAN.md §31.5). The root layout wraps the app in `<ThemeProvider>`
 * with the stored settings; components read the theme with `useTheme()` and create their
 * styles with `makeStyles` (memoised per theme, so StyleSheet.create still runs once per
 * theme, not per render).
 */
import { createContext, useContext, type ReactNode } from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  defaultTheme,
  getTheme,
  resolveScheme,
  withFontFamily,
  type Theme,
  type ThemeMode,
} from './theme';

const ThemeContext = createContext<Theme>(defaultTheme);

interface ThemeProviderProps {
  mode: ThemeMode;
  dyslexiaFont: boolean;
  children: ReactNode;
}

export function ThemeProvider({ mode, dyslexiaFont, children }: ThemeProviderProps) {
  const system = useColorScheme();
  const theme = getTheme(resolveScheme(mode, system), dyslexiaFont);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** The active theme (the dark default outside a provider, e.g. in isolated tests). */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Turns a style factory into a hook: `const useStyles = makeStyles((t) => ({ ... }))` at
 * module level, then `const styles = useStyles()` in the component. Text styles get the
 * theme's font family (`withFontFamily`).
 */
export function makeStyles<T extends NamedStyles>(factory: (theme: Theme) => T): () => T {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (styles === undefined) {
      styles = StyleSheet.create(withFontFamily(factory(theme), theme.fonts));
      cache.set(theme, styles);
    }
    return styles;
  };
}
