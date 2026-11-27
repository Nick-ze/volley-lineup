/**
 * v8: font families (docs/PLAN.md §31.6). `system` uses the platform font (no family set);
 * `dyslexia` uses the bundled OpenDyslexic files (DECISIONS: Dyslexie is commercial). The
 * family names must match the keys passed to expo-font's `useFonts` (`src/lib/fonts.ts`).
 */
export const DYSLEXIA_FONT_REGULAR = 'OpenDyslexic-Regular';
export const DYSLEXIA_FONT_BOLD = 'OpenDyslexic-Bold';
/**
 * v11: the display typeface for titles, scores and roster numbers (Barlow Condensed, SIL OFL 1.1,
 * `assets/fonts/BarlowCondensed-OFL.txt`). Its digits are not equal-width by default: numbers
 * need `fontVariant: ['tabular-nums']`.
 */
export const DISPLAY_FONT_BOLD = 'BarlowCondensed-Bold';
export const DISPLAY_FONT_HEAVY = 'BarlowCondensed-ExtraBold';
const DISPLAY_FAMILIES: readonly string[] = [DISPLAY_FONT_BOLD, DISPLAY_FONT_HEAVY];

/** True for a `fontFamily` of the display typeface. */
export const isDisplayFamily = (family: string | undefined): boolean =>
  family !== undefined && DISPLAY_FAMILIES.includes(family);

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
  /** v11: family for display text (titles). With the dyslexia font on, that font's bold family. */
  display: string;
  /** v11: family for the heaviest display text (scores, roster numbers). */
  displayHeavy: string;
  /**
   * v11: extra factor for display sizes. The condensed typeface is set large; a normal-width
   * font at the same size would be far too wide, so the dyslexia font draws display text smaller.
   */
  displayScale: number;
}

export const systemFonts: ThemeFonts = {
  regular: undefined,
  bold: undefined,
  scale: 1,
  lineHeight: undefined,
  display: DISPLAY_FONT_BOLD,
  displayHeavy: DISPLAY_FONT_HEAVY,
  displayScale: 1,
};
export const dyslexiaFonts: ThemeFonts = {
  regular: DYSLEXIA_FONT_REGULAR,
  bold: DYSLEXIA_FONT_BOLD,
  scale: 0.85,
  lineHeight: 1.4,
  display: DYSLEXIA_FONT_BOLD,
  displayHeavy: DYSLEXIA_FONT_BOLD,
  displayScale: 0.75,
};
