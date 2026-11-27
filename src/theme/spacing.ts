export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * v11: corners by role. `sm` badges, name pills, segments · `md` fields, tracks, tiles, banners ·
 * `lg` panels, rows, cards, point buttons · `xl` dialogs, sheets, the scoreboard · `round` pills.
 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  round: 999,
} as const;

/** Minimum touch target size (CLAUDE.md accessibility rule). */
export const touchTarget = 44;

/** Width above which the layout switches to side-by-side (court left, bench right). */
export const wideBreakpoint = 768;

/** Border widths. */
export const borderWidth = {
  thin: 1,
  thick: 3,
} as const;

/** Max width of a centred dialog card. */
export const dialogMaxWidth = 420;

/** Max content width on desktop. */
export const maxContentWidth = 1100;
