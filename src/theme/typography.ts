import type { TextStyle } from 'react-native';

import { DISPLAY_FONT_BOLD, DISPLAY_FONT_HEAVY } from './fonts';

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const typography = {
  title: { fontSize: fontSize.xxl, fontWeight: '700' },
  heading: { fontSize: fontSize.xl, fontWeight: '700' },
  subheading: { fontSize: fontSize.lg, fontWeight: '600' },
  body: { fontSize: fontSize.md, fontWeight: '400' },
  label: { fontSize: fontSize.sm, fontWeight: '600' },
  caption: { fontSize: fontSize.xs, fontWeight: '400' },
  jersey: { fontSize: fontSize.xl, fontWeight: '800' },
  // v11 (docs/V11_DESIGN.md): display text in the condensed typeface. No `fontWeight`: a custom
  // family carries its weight. With the dyslexia font on, `withFontFamily` swaps the family and
  // draws these smaller (`fonts.displayScale`).
  /** Titles of the tab screens and the profile picker. */
  displayXL: { fontFamily: DISPLAY_FONT_BOLD, fontSize: 48, lineHeight: 53 },
  /** Titles of pushed browse screens, the point buttons, the large stat numbers. */
  displayL: { fontFamily: DISPLAY_FONT_BOLD, fontSize: 34, lineHeight: 38 },
  /** The compact header title, dialog titles, stat numbers. */
  displayM: { fontFamily: DISPLAY_FONT_BOLD, fontSize: 26, lineHeight: 29 },
  /** The live score. */
  score: {
    fontFamily: DISPLAY_FONT_HEAVY,
    fontSize: 104,
    lineHeight: 100,
    fontVariant: ['tabular-nums'],
  },
  /** A small capital label above a title or a group (normal case with the dyslexia font). */
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;
