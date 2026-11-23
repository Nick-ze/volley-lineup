/**
 * The printable lineup sheet's style sheet: light print theme, A4 portrait (`theme/print.ts`).
 *
 * Part of the printable lineup sheet: `lineupSheet.ts` imports it, never the other way round.
 */
import { printColors as c, printLayout as l } from '../theme/print';

/** Inline CSS of the sheet document. */
export const LINEUP_SHEET_CSS = `
@page { size: ${l.pageSize}; margin: ${l.pageMargin}; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${c.background}; color: ${c.text}; }
body { font-family: ${l.fontFamily}; font-size: ${l.baseFontSize}; line-height: 1.3;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
header { border-bottom: 2px solid ${c.border}; padding-bottom: 6px; margin-bottom: ${l.sectionGap}; }
h1 { font-size: ${l.titleFontSize}; margin: 0 0 4px; }
h2 { font-size: ${l.headingFontSize}; margin: 0 0 4px; }
dl.meta { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 0; }
dl.meta div { display: flex; gap: 4px; }
dt { color: ${c.textMuted}; } dd { margin: 0; font-weight: 600; }
.sets { display: grid; grid-template-columns: 1fr 1fr; gap: ${l.setGap}; }
.set { break-inside: avoid; page-break-inside: avoid; border: 1px solid ${c.border}; padding: ${l.setPadding}; }
.net { background: ${c.fill}; border: 1px solid ${c.border}; text-align: center;
  font-size: ${l.smallFontSize}; letter-spacing: 2px; text-transform: uppercase; }
table.court { width: 100%; border-collapse: collapse; table-layout: fixed; }
td.cell { border: 1px solid ${c.grid}; height: ${l.cellHeight}; vertical-align: top; padding: 3px 4px; }
td.serving { border: 2px solid ${c.border}; }
.pos { display: block; font-size: ${l.smallFontSize}; line-height: 1.15; color: ${c.textMuted}; }
.role { float: right; font-weight: 700; color: ${c.text}; }
.off { font-weight: 800; }
p.off-note { float: right; margin: 0; font-size: ${l.smallFontSize}; color: ${c.textMuted}; }
.srv { font-weight: 700; color: ${c.text}; }
.num { display: block; font-size: ${l.jerseyFontSize}; font-weight: 700; line-height: 1; }
/* One line per name in a court cell (the roster lists full names), so the sheet keeps its height. */
.name { display: block; font-size: ${l.nameFontSize}; line-height: 1.2; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; }
.info .num, .info .name { display: inline; font-size: ${l.infoFontSize}; margin-right: 4px; }
.info { margin-top: 3px; font-size: ${l.infoFontSize}; line-height: 1.2; display: grid; gap: 1px; }
.info > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.label { color: ${c.textMuted}; }
.empty { color: ${c.textMuted}; }
section.roster-section { margin-top: ${l.sectionGap}; }
table.roster thead { display: table-header-group; }
table.roster tr { break-inside: avoid; page-break-inside: avoid; }
table.roster { width: 100%; border-collapse: collapse; font-size: ${l.infoFontSize}; line-height: 1.15; }
table.roster th, table.roster td { border: 1px solid ${c.grid}; padding: 1px 6px; text-align: left; }
table.roster th { background: ${c.fill}; }
table.roster td.n { width: 3em; font-weight: 700; text-align: right; }
/* Compact: everything on one line (wraps only if needed), so a 5-set sheet stays on one page. */
section.results { break-inside: avoid; page-break-inside: avoid; border: 1px solid ${c.border};
  padding: 2px ${l.setPadding}; margin-bottom: ${l.setGap.split(' ')[0]}; font-size: ${l.infoFontSize};
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 12px; line-height: 1.25; }
section.results h2 { margin: 0; }
.final { font-size: ${l.headingFontSize}; font-weight: 700; }
ul.set-scores { display: flex; flex-wrap: wrap; gap: 0 10px; list-style: none; margin: 0; padding: 0; }
`;
