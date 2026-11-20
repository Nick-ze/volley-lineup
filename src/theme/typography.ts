import type { TextStyle } from 'react-native';

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
} as const satisfies Record<string, TextStyle>;
