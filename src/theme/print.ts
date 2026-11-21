/**
 * Print theme for the lineup sheet: light, black on white (saves ink, reads well on paper).
 * Plain CSS values, because the sheet is an HTML document, not a React Native view.
 */
export const printColors = {
  text: '#000000',
  textMuted: '#444444',
  background: '#FFFFFF',
  border: '#000000',
  grid: '#888888',
  fill: '#EEEEEE', // net bar, table header, libero/serve box
} as const;

export const printLayout = {
  pageSize: 'A4 portrait',
  pageMargin: '12mm',
  fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  baseFontSize: '11pt',
  titleFontSize: '18pt',
  headingFontSize: '12pt',
  /** Court cell height; small enough that 5 sets + a 12-player roster fit on one A4 page. */
  cellHeight: '44px',
  jerseyFontSize: '15pt',
  nameFontSize: '8pt',
  smallFontSize: '7pt',
  infoFontSize: '9pt',
  setGap: '8px 14px',
  setPadding: '5px',
  sectionGap: '10px',
} as const;
