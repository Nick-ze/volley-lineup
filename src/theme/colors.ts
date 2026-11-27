/**
 * Design tokens from docs/PLAN.md §8 (v8: §31.5 light / dark). Never hard-code colours
 * elsewhere. Components read the active palette with `useTheme()` / `makeStyles` (see
 * `ThemeProvider.tsx`); both palettes have the same keys.
 */
export const darkColors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceRaised: '#242424',
  border: '#2A2A2A',
  primary: '#FF6B00', // orange: buttons, active states, court
  /** v8: orange for text / icons on the background (AA on `background` and `surface`). */
  primaryText: '#FF6B00',
  onPrimary: '#0D0D0D', // text on orange (black passes AA; white does not)
  highlight: '#FFC72C', // volleyball yellow: server, selected set, drop targets
  onHighlight: '#0D0D0D',
  /** v8: yellow for text / icons on the background (warnings, drop hints, "*"). */
  highlightText: '#FFC72C',
  highlightGlow: 'rgba(255,199,44,0.45)', // translucent yellow fill: hovered drop target
  secondary: '#0057B8', // volleyball blue: front row, secondary fills
  secondaryText: '#3D8BFF', // blue for text/links on black
  onSecondary: '#FFFFFF',
  text: '#FFFFFF',
  textMuted: '#A0A0A0',
  error: '#FF4D4F',
  /** v8: text / icons on the orange court (chips sit on their own fills). */
  onCourt: '#0D0D0D',
  net: '#FFFFFF',
  courtLine: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.6)',
  transparent: 'transparent',
  // v11 (docs/V11_DESIGN.md): shades of the palette's own colours.
  /** Soft orange: a selected segment or chip, the active tab's marker. */
  primarySoft: '#2B1707',
  /** A pressed primary button. */
  primaryPressed: '#E05E00',
  /** Soft yellow: notices (banners). */
  highlightSoft: '#2E2508',
  /** Soft blue: chips about the opponent / a positive rating. */
  secondarySoft: '#0A1E36',
  /** The "active" dot (a mark beside its text, never text itself). */
  positive: '#2ECC71',
  /** Shadow under a player chip that stands on a court. */
  chipShadow: 'rgba(0,0,0,0.4)',
} as const;

export type ColorToken = keyof typeof darkColors;
export type ThemeColors = Record<ColorToken, string>;

/**
 * v8 light ("white") theme. Every text colour passes WCAG AA (4.5:1) on `background`,
 * `surface` and `surfaceRaised`; the court keeps its orange with white lines.
 */
export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F3F3F3',
  surfaceRaised: '#E8E8E8',
  border: '#C8C8C8',
  primary: '#FF6B00',
  primaryText: '#A84300',
  onPrimary: '#0D0D0D',
  highlight: '#FFC72C',
  onHighlight: '#0D0D0D',
  highlightText: '#7A5600',
  highlightGlow: 'rgba(255,199,44,0.55)',
  secondary: '#0057B8',
  secondaryText: '#0050A8',
  onSecondary: '#FFFFFF',
  text: '#111111',
  textMuted: '#555555',
  error: '#C62828',
  onCourt: '#0D0D0D',
  net: '#FFFFFF',
  courtLine: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.45)',
  transparent: 'transparent',
  primarySoft: '#FFE9D9',
  primaryPressed: '#E05E00',
  highlightSoft: '#FFF4D1',
  secondarySoft: '#E0ECFA',
  positive: '#2ECC71',
  chipShadow: 'rgba(0,0,0,0.4)',
};

type BadgeColors = Record<'S' | 'OH' | 'MB' | 'OPP' | 'L' | 'DS', { bg: string; text: string }>;

/** Badge colours per volleyball position. All pass AA with their `text` colour. */
export const darkPositionColors = {
  S: { bg: '#FFC72C', text: '#0D0D0D' },
  OH: { bg: '#3D8BFF', text: '#0D0D0D' },
  MB: { bg: '#2ECC71', text: '#0D0D0D' },
  OPP: { bg: '#C77DFF', text: '#0D0D0D' },
  L: { bg: '#FFFFFF', text: '#0D0D0D' },
  DS: { bg: '#A0A0A0', text: '#0D0D0D' },
} as const satisfies BadgeColors;

/** v8: the same badges on a light background (the white libero badge becomes light grey). */
export const lightPositionColors: BadgeColors = {
  ...darkPositionColors,
  L: { bg: '#DADADA', text: '#0D0D0D' },
};

/** Avatar colours a manager profile (v8: and a team's initial) can pick from. */
export const profileColors = [
  '#FF6B00',
  '#FFC72C',
  '#3D8BFF',
  '#2ECC71',
  '#C77DFF',
  '#FF4D4F',
] as const;

/** Text on a `profileColors` avatar (all pass AA with near-black). */
export const onProfileColor = '#0D0D0D';
