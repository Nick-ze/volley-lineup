/** Design tokens from docs/PLAN.md §8. Never hard-code colours elsewhere. */
export const colors = {
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceRaised: '#242424',
  border: '#2A2A2A',
  primary: '#FF6B00', // orange: buttons, active states, court
  onPrimary: '#0D0D0D', // text on orange (black passes AA; white does not)
  highlight: '#FFC72C', // volleyball yellow: server, selected set, drop targets
  onHighlight: '#0D0D0D',
  highlightGlow: 'rgba(255,199,44,0.45)', // translucent yellow fill: hovered drop target
  secondary: '#0057B8', // volleyball blue: front row, secondary fills
  secondaryText: '#3D8BFF', // blue for text/links on black
  onSecondary: '#FFFFFF',
  text: '#FFFFFF',
  textMuted: '#A0A0A0',
  error: '#FF4D4F',
  net: '#FFFFFF',
  courtLine: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.6)',
  transparent: 'transparent',
} as const;

/** Badge colours per volleyball position. All pass AA with their `text` colour. */
export const positionColors = {
  S: { bg: '#FFC72C', text: '#0D0D0D' },
  OH: { bg: '#3D8BFF', text: '#0D0D0D' },
  MB: { bg: '#2ECC71', text: '#0D0D0D' },
  OPP: { bg: '#C77DFF', text: '#0D0D0D' },
  L: { bg: '#FFFFFF', text: '#0D0D0D' },
  DS: { bg: '#A0A0A0', text: '#0D0D0D' },
} as const;

/** Avatar colours a manager profile can pick from. */
export const profileColors = [
  '#FF6B00',
  '#FFC72C',
  '#3D8BFF',
  '#2ECC71',
  '#C77DFF',
  '#FF4D4F',
] as const;

export type ColorToken = keyof typeof colors;
