/**
 * Printable lineup sheet (v2 feature 5): builds a self-contained HTML document (inline CSS,
 * light print theme, A4 portrait) for a match — header, every stored set's starting six in court
 * layout (net on top, front row 4-3-2, back row 5-6-1), libero, who serves first, and the roster.
 *
 * Pure: no React, no i18n import. Translated labels come in through `labels`, and every piece of
 * user text (names, team, opponent, season, labels) is HTML-escaped.
 */
import { printColors as c, printLayout as l } from '../theme/print';
import type { CourtPosition, Match, Player, SetLineup, Team } from './types';

export interface LineupSheetLabels {
  /** Document title, e.g. "Lineup · Team vs Opponent". */
  documentTitle: string;
  opponent: string;
  date: string;
  venue: string;
  home: string;
  away: string;
  season: string;
  setTitle: (setNumber: number) => string;
  net: string;
  /** Small label in each court cell, e.g. "P4". */
  positionShort: (position: number) => string;
  emptySlot: string;
  unknownPlayer: string;
  libero: string;
  noLibero: string;
  /** e.g. "Libero replaces #7, #12" (`numbers` is already formatted). */
  liberoReplaces: (numbers: string) => string;
  serveFirst: string;
  weServe: string;
  weReceive: string;
  server: string;
  noSets: string;
  roster: string;
  number: string;
  name: string;
  positions: string;
  status: string;
  inactive: string;
  noPlayers: string;
}

export interface LineupSheetInput {
  match: Match;
  team: Team;
  /** Players of the team (others are ignored for the roster but still resolved on court). */
  players: Player[];
  labels: LineupSheetLabels;
  /** `lang` attribute of the document (default `en`). */
  lang?: string;
}

/** Court cells in reading order: front row under the net, then the back row. */
export const SHEET_ROWS: readonly (readonly CourtPosition[])[] = [
  [4, 3, 2],
  [5, 6, 1],
] as const;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for use in HTML element content and quoted attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function playerName(player: Player): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

function playerCell(player: Player | undefined, id: string | null, labels: LineupSheetLabels) {
  if (!id) return `<span class="empty">${escapeHtml(labels.emptySlot)}</span>`;
  if (!player) return `<span class="empty">${escapeHtml(labels.unknownPlayer)}</span>`;
  return (
    `<span class="num">${player.number}</span>` +
    `<span class="name">${escapeHtml(playerName(player))}</span>`
  );
}

function renderSet(set: SetLineup, byId: Map<string, Player>, labels: LineupSheetLabels): string {
  const rows = SHEET_ROWS.map((row) => {
    const cells = row.map((pos) => {
      const id = set.slots[pos];
      const serving = pos === 1 && set.weServeFirst;
      const tag = serving ? ` <span class="srv">${escapeHtml(labels.server)}</span>` : '';
      return (
        `<td class="cell${serving ? ' serving' : ''}" data-position="${pos}">` +
        `<span class="pos">${escapeHtml(labels.positionShort(pos))}${tag}</span>` +
        `${playerCell(id ? byId.get(id) : undefined, id, labels)}</td>`
      );
    });
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  const libero = set.liberoId
    ? playerCell(byId.get(set.liberoId), set.liberoId, labels)
    : `<span class="empty">${escapeHtml(labels.noLibero)}</span>`;
  const serve = set.weServeFirst ? labels.weServe : labels.weReceive;
  const replaced = set.liberoReplaces
    .map((id) => byId.get(id))
    .filter((p): p is Player => p !== undefined)
    .map((p) => `#${p.number}`);
  const replaces =
    set.liberoId && replaced.length > 0
      ? `<div class="replaces">${escapeHtml(labels.liberoReplaces(replaced.join(', ')))}</div>`
      : '';

  return (
    `<section class="set" data-set="${set.setNumber}">` +
    `<h2>${escapeHtml(labels.setTitle(set.setNumber))}</h2>` +
    `<div class="net">${escapeHtml(labels.net)}</div>` +
    `<table class="court">${rows}</table>` +
    `<div class="info">` +
    `<div class="libero"><span class="label">${escapeHtml(labels.libero)}</span> ${libero}</div>` +
    replaces +
    `<div class="serve"><span class="label">${escapeHtml(labels.serveFirst)}</span> ` +
    `${escapeHtml(serve)}</div>` +
    `</div></section>`
  );
}

function renderRoster(players: Player[], labels: LineupSheetLabels): string {
  if (players.length === 0) return `<p class="empty">${escapeHtml(labels.noPlayers)}</p>`;
  const body = players
    .map(
      (p) =>
        `<tr><td class="n">${p.number}</td><td>${escapeHtml(playerName(p))}</td>` +
        `<td>${escapeHtml(p.positions.join(', '))}</td>` +
        `<td>${p.active ? '' : escapeHtml(labels.inactive)}</td></tr>`,
    )
    .join('');
  return (
    `<table class="roster"><thead><tr><th>${escapeHtml(labels.number)}</th>` +
    `<th>${escapeHtml(labels.name)}</th><th>${escapeHtml(labels.positions)}</th>` +
    `<th>${escapeHtml(labels.status)}</th></tr></thead><tbody>${body}</tbody></table>`
  );
}

const CSS = `
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
.pos { display: block; font-size: ${l.smallFontSize}; color: ${c.textMuted}; }
.srv { font-weight: 700; color: ${c.text}; }
.num { display: block; font-size: ${l.jerseyFontSize}; font-weight: 700; line-height: 1.1; }
.name { display: block; font-size: ${l.nameFontSize}; overflow-wrap: anywhere; }
.info .num, .info .name { display: inline; font-size: ${l.infoFontSize}; margin-right: 4px; }
.info { margin-top: 4px; font-size: ${l.infoFontSize}; display: grid; gap: 2px; }
.label { color: ${c.textMuted}; }
.empty { color: ${c.textMuted}; }
section.roster-section { margin-top: ${l.sectionGap}; }
table.roster thead { display: table-header-group; }
table.roster tr { break-inside: avoid; page-break-inside: avoid; }
table.roster { width: 100%; border-collapse: collapse; font-size: ${l.infoFontSize}; }
table.roster th, table.roster td { border: 1px solid ${c.grid}; padding: 2px 6px; text-align: left; }
table.roster th { background: ${c.fill}; }
table.roster td.n { width: 3em; font-weight: 700; text-align: right; }
`;

/** Builds the full printable HTML document for a match. */
export function buildLineupSheetHtml(input: LineupSheetInput): string {
  const { match, team, labels } = input;
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const roster = input.players
    .filter((p) => p.teamId === team.id)
    .sort((a, b) => a.number - b.number);
  const sets = [...match.sets].sort((a, b) => a.setNumber - b.setNumber);

  const meta: [string, string][] = [
    [labels.opponent, match.opponent],
    [labels.date, match.date],
    [labels.venue, match.home ? labels.home : labels.away],
  ];
  if (team.season) meta.push([labels.season, team.season]);
  const metaHtml = meta
    .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join('');

  const setsHtml =
    sets.length > 0
      ? `<div class="sets">${sets.map((s) => renderSet(s, byId, labels)).join('')}</div>`
      : `<p class="empty">${escapeHtml(labels.noSets)}</p>`;

  return (
    `<!DOCTYPE html><html lang="${escapeHtml(input.lang ?? 'en')}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(labels.documentTitle)}</title><style>${CSS}</style></head><body>` +
    `<header><h1>${escapeHtml(team.name)}</h1><dl class="meta">${metaHtml}</dl></header>` +
    `<main>${setsHtml}<section class="roster-section"><h2>${escapeHtml(labels.roster)}</h2>` +
    `${renderRoster(roster, labels)}</section></main></body></html>`
  );
}
