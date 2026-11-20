export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  round: 999,
} as const;

/** Minimum touch target size (CLAUDE.md accessibility rule). */
export const touchTarget = 44;

/** Width above which the layout switches to side-by-side (court left, bench right). */
export const wideBreakpoint = 768;

/** Max content width on desktop. */
export const maxContentWidth = 1100;
