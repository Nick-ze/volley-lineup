/**
 * v8: font families (docs/PLAN.md §31.6). `system` uses the platform font (no family set);
 * `dyslexia` uses the bundled OpenDyslexic files (DECISIONS: Dyslexie is commercial). The
 * family names must match the keys passed to expo-font's `useFonts` (`src/lib/fonts.ts`).
 */
export const DYSLEXIA_FONT_REGULAR = 'OpenDyslexic-Regular';
export const DYSLEXIA_FONT_BOLD = 'OpenDyslexic-Bold';

export interface ThemeFonts {
  /** Family for normal text, or undefined for the platform font. */
  regular: string | undefined;
  /** Family for bold text (fontWeight ≥ 600), or undefined for the platform font. */
  bold: string | undefined;
  /**
   * Factor for font sizes and line heights. OpenDyslexic's letters are much larger and wider
   * than the platform font's at the same size, so it is drawn a little smaller to keep the
   * layouts at 375 px (courts, the live screen, tables) fitting.
   */
  scale: number;
  /**
   * Line height (times the font size) for text styles without their own, or undefined for the
   * font's normal one. OpenDyslexic's normal line is about 1.8× the size, which made buttons,
   * chips and the live screen much taller.
   */
  lineHeight: number | undefined;
}

export const systemFonts: ThemeFonts = {
  regular: undefined,
  bold: undefined,
  scale: 1,
  lineHeight: undefined,
};
export const dyslexiaFonts: ThemeFonts = {
  regular: DYSLEXIA_FONT_REGULAR,
  bold: DYSLEXIA_FONT_BOLD,
  scale: 0.85,
  lineHeight: 1.4,
};
