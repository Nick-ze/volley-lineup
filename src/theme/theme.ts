/**
 * v8: the active theme (docs/PLAN.md §31.5–31.6): colours for dark or light mode plus the font
 * families (platform font or the dyslexia-friendly font). Plain data and pure helpers; the
 * React side is in `ThemeProvider.tsx`.
 */
import type { TextStyle } from 'react-native';

import {
  darkColors,
  darkPositionColors,
  lightColors,
  lightPositionColors,
  type ThemeColors,
} from './colors';
import { dyslexiaFonts, systemFonts, type ThemeFonts } from './fonts';

export type ColorScheme = 'dark' | 'light';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  positionColors: Record<'S' | 'OH' | 'MB' | 'OPP' | 'L' | 'DS', { bg: string; text: string }>;
  fonts: ThemeFonts;
  /** True when the dyslexia-friendly font is on. */
  dyslexiaFont: boolean;
}

/** The theme setting as stored (`AppState.themeMode`). */
export type ThemeMode = 'dark' | 'light' | 'system';

/** The colour scheme to use: 'system' follows the device (dark when it says nothing). */
export function resolveScheme(
  mode: ThemeMode,
  system: ColorScheme | null | undefined,
): ColorScheme {
  if (mode !== 'system') return mode;
  return system === 'light' ? 'light' : 'dark';
}

const build = (scheme: ColorScheme, dyslexiaFont: boolean): Theme => ({
  scheme,
  colors: scheme === 'dark' ? darkColors : lightColors,
  positionColors: scheme === 'dark' ? darkPositionColors : lightPositionColors,
  fonts: dyslexiaFont ? dyslexiaFonts : systemFonts,
  dyslexiaFont,
});

/** The four themes are built once, so a theme can be used as a cache key. */
const THEMES = {
  dark: { false: build('dark', false), true: build('dark', true) },
  light: { false: build('light', false), true: build('light', true) },
} as const;

export function getTheme(scheme: ColorScheme, dyslexiaFont: boolean): Theme {
  return THEMES[scheme][dyslexiaFont ? 'true' : 'false'];
}

/** The default theme (today's dark look, platform font). */
export const defaultTheme = getTheme('dark', false);

const TEXT_KEYS = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const;

const isBold = (weight: TextStyle['fontWeight']) =>
  weight === 'bold' || (weight !== undefined && weight !== 'normal' && Number(weight) >= 600);

/**
 * Gives every text style the theme's font family. A style counts as a text style when it sets
 * a font size, weight, line height or letter spacing. Bold styles (weight ≥ 600) get the bold
 * family and lose their `fontWeight` (custom fonts carry the weight in the family; a weight on
 * top would make some platforms fake-bold it or miss the font). With the platform font
 * (`fonts.regular` undefined) the styles are returned unchanged.
 */
export function withFontFamily<T extends Record<string, object>>(styles: T, fonts: ThemeFonts): T {
  if (fonts.regular === undefined) return styles;
  const out: Record<string, object> = {};
  for (const [name, style] of Object.entries(styles)) {
    const text = style as TextStyle;
    if (text.fontFamily !== undefined || !TEXT_KEYS.some((key) => key in text)) {
      out[name] = style;
      continue;
    }
    const bold = isBold(text.fontWeight);
    const { fontWeight: _weight, ...rest } = text;
    out[name] = { ...rest, fontFamily: bold ? fonts.bold : fonts.regular };
  }
  return out as T;
}
