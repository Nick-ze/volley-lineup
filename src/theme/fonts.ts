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
}

export const systemFonts: ThemeFonts = { regular: undefined, bold: undefined };
export const dyslexiaFonts: ThemeFonts = {
  regular: DYSLEXIA_FONT_REGULAR,
  bold: DYSLEXIA_FONT_BOLD,
};
