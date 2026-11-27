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
import { dyslexiaFonts, isDisplayFamily, systemFonts, type ThemeFonts } from './fonts';

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
  if (mode === 'dark' || mode === 'light') return mode;
  // 'system' — and any corrupt stored value, which falls back like an unknown device setting.
  return mode === 'system' && system === 'light' ? 'light' : 'dark';
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
 * `fontSize` times `fonts.scale` (whole pixels); a style with a size but no line height gets
 * `fonts.lineHeight` times its new size. A style's own line height stays (it often centres the
 * text in a fixed-height box).
 */
function scaled(text: TextStyle, fonts: ThemeFonts): Pick<TextStyle, 'fontSize' | 'lineHeight'> {
  if (typeof text.fontSize !== 'number') return {};
  const fontSize = Math.round(text.fontSize * fonts.scale);
  return text.lineHeight === undefined && fonts.lineHeight !== undefined
    ? { fontSize, lineHeight: Math.round(fontSize * fonts.lineHeight) }
    : { fontSize };
}

/**
 * v11: a display style (the condensed typeface) with another font: drawn smaller
 * (`fonts.scale` × `fonts.displayScale`), with that font's own line height.
 */
function scaledDisplay(
  size: number,
  fonts: ThemeFonts,
): Pick<TextStyle, 'fontSize' | 'lineHeight'> {
  const fontSize = Math.round(size * fonts.scale * fonts.displayScale);
  return fonts.lineHeight === undefined
    ? { fontSize }
    : { fontSize, lineHeight: Math.round(fontSize * fonts.lineHeight) };
}

/**
 * A font size computed at render time (e.g. from a chip's diameter), sized like `makeStyles`
 * sizes its styles: with the dyslexia font scaled and with a matching line height, so the
 * inline size and the line height never disagree. With the platform font: `{ fontSize }`.
 * v11: `display` for text in the display typeface (`fonts.display` / `fonts.displayHeavy`).
 */
export function inlineFontSize(
  size: number,
  fonts: ThemeFonts,
  display = false,
): Pick<TextStyle, 'fontSize' | 'lineHeight'> {
  if (fonts.regular === undefined) return { fontSize: size };
  return display ? scaledDisplay(size, fonts) : scaled({ fontSize: size }, fonts);
}

/** A capital-letter label without its capitals and wide letter spacing (v11). */
function plainCase(text: TextStyle): TextStyle {
  if (text.textTransform !== 'uppercase') return text;
  const { textTransform: _transform, letterSpacing, ...rest } = text;
  return letterSpacing !== undefined && letterSpacing < 0 ? { ...rest, letterSpacing } : rest;
}

/**
 * Gives every text style the theme's font family. A style counts as a text style when it sets
 * a font size, weight, line height or letter spacing. Bold styles (weight ≥ 600) get the bold
 * family and lose their `fontWeight` (custom fonts carry the weight in the family; a weight on
 * top would make some platforms fake-bold it or miss the font). Font sizes are multiplied by
 * `fonts.scale` (the dyslexia font is drawn smaller); sized text without a line height gets
 * `fonts.lineHeight` times its new size, and a style's own line height is kept unscaled. Sizes
 * computed at render time use `inlineFontSize`. With the platform font (`fonts.regular`
 * undefined) the styles are returned unchanged.
 * v11: a style in the display typeface gets the theme's bold family, drawn smaller
 * (`scaledDisplay`); a capital-letter label (`textTransform: 'uppercase'`) becomes normal case
 * without its wide letter spacing, because capitals are harder to read in the dyslexia font.
 */
export function withFontFamily<T extends Record<string, object>>(styles: T, fonts: ThemeFonts): T {
  if (fonts.regular === undefined) return styles;
  const out: Record<string, object> = {};
  for (const [name, style] of Object.entries(styles)) {
    const text = style as TextStyle;
    if (isDisplayFamily(text.fontFamily)) {
      const size = typeof text.fontSize === 'number' ? scaledDisplay(text.fontSize, fonts) : {};
      out[name] = { ...text, ...size, fontFamily: fonts.bold };
      continue;
    }
    if (text.fontFamily !== undefined || !TEXT_KEYS.some((key) => key in text)) {
      out[name] = style;
      continue;
    }
    const bold = isBold(text.fontWeight);
    const { fontWeight: _weight, ...rest } = text;
    out[name] = {
      ...plainCase(rest),
      ...scaled(text, fonts),
      fontFamily: bold ? fonts.bold : fonts.regular,
    };
  }
  return out as T;
}
