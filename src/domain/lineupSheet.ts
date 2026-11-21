/**
 * Printable lineup sheet (v2 feature 5): builds a self-contained HTML document (inline CSS,
 * light print theme, A4 portrait) for a match — header, every stored set's starting six in court
 * layout (net on top, front row 4-3-2, back row 5-6-1), libero, who serves first, and the roster.
 * Optionally (v3, `withResults`) a played match gets a results section above the sets.
 * v4: every filled spot shows the role its player plays (e.g. "S", "OPP"; "*" when it is none of
 * the player's positions, explained in a note under the sets), and a switched-off libero says so.
 *
 * Pure: no React, no i18n import. Translated labels come in through `labels`, and every piece of
 * user text (names, team, opponent, season, labels) is HTML-escaped.
 */
import { printColors as c, printLayout as l } from '../theme/print';
import { getMatchState, type MatchState } from './matchState';
import { isOffPosition, roleOf } from './roles';
import type { CourtPosition, Match, Player, SetLineup, Team } from './types';

/** Labels of the optional "with results" section (v3). */
export interface LineupSheetResultLabels {
  heading: string;
  /** Final result of a decided match, e.g. "Won" / "Lost"; "In progress" otherwise. */
  won: string;
  lost: string;
  inProgress: string;
  setsWon: string;
  /** e.g. "Set 1 25:21"; `open` is true for a set that is still being played. */
  setScore: (setNumber: number, us: number, them: number, open: boolean) => string;
  duration: string;
  /** e.g. "1 h 32 min" from whole hours and the remaining minutes. */
  durationValue: (hours: number, minutes: number) => string;
}

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
  /** v4: shown instead of whom the libero replaces when the libero is switched off. */
  liberoOff: string;
  /** v4: explains the "*" next to a role; shown under the sets when any spot has one. */
  offPositionNote: string;
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
  results: LineupSheetResultLabels;
}

export interface LineupSheetInput {
  match: Match;
  team: Team;
  /** Players of the team (others are ignored for the roster but still resolved on court). */
  players: Player[];
  labels: LineupSheetLabels;
  /** `lang` attribute of the document (default `en`). */
  lang?: string;
  /**
   * Adds the results section (final result, sets won, every played set's score, duration).
   * Ignored for a match that hasn't started, so it prints exactly as without it.
   */
  withResults?: boolean;
}

/** True once a rally of the match has been played, i.e. there are results to print. */
export function hasResults(match: Pick<Match, 'sets'>): boolean {
  return getMatchState(match).status !== 'notStarted';
}

/** Whole hours and remaining minutes of a duration, rounded to the nearest minute. */
export function durationParts(ms: number): { hours: number; minutes: number } {
  const total = Math.round(ms / 60_000);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
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

/** The role code of a known player on court (e.g. "S"), with "*" when off position. */
function roleTag(set: SetLineup, player: Player | undefined): string {
  if (!player) return '';
  const role = roleOf(set.roles, player);
  if (role === null) return '';
  const off = isOffPosition(player, role) ? '<span class="off">*</span>' : '';
  return `<span class="role">${escapeHtml(role)}${off}</span>`;
}

/** True when a known starter of the set plays a role that is none of their positions. */
function hasOffPosition(set: SetLineup, byId: Map<string, Player>): boolean {
  return Object.values(set.slots).some((id) => {
    const player = id ? byId.get(id) : undefined;
    return player !== undefined && isOffPosition(player, roleOf(set.roles, player));
  });
}

function renderSet(set: SetLineup, byId: Map<string, Player>, labels: LineupSheetLabels): string {
  const rows = SHEET_ROWS.map((row) => {
    const cells = row.map((pos) => {
      const id = set.slots[pos];
      const player = id ? byId.get(id) : undefined;
      const serving = pos === 1 && set.weServeFirst;
      const tag = serving ? ` <span class="srv">${escapeHtml(labels.server)}</span>` : '';
      return (
        `<td class="cell${serving ? ' serving' : ''}" data-position="${pos}">` +
        `<span class="pos">${roleTag(set, player)}` +
        `${escapeHtml(labels.positionShort(pos))}${tag}</span>` +
        `${playerCell(player, id, labels)}</td>`
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
  let replaces = '';
  if (set.liberoId && !set.liberoActive)
    replaces = `<div class="libero-off">${escapeHtml(labels.liberoOff)}</div>`;
  else if (set.liberoId && replaced.length > 0)
    replaces = `<div class="replaces">${escapeHtml(labels.liberoReplaces(replaced.join(', ')))}</div>`;

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

function renderResults(state: MatchState, labels: LineupSheetResultLabels): string {
  const status =
    state.status === 'won' ? labels.won : state.status === 'lost' ? labels.lost : labels.inProgress;
  const sets = state.sets
    .filter((set) => set.status !== 'notStarted')
    .map((set) => {
      const text = labels.setScore(
        set.setNumber,
        set.score.us,
        set.score.them,
        set.status === 'inProgress',
      );
      return `<li data-set-result="${set.setNumber}">${escapeHtml(text)}</li>`;
    })
    .join('');
  const line = (cls: string, label: string, value: string) =>
    `<div class="${cls}"><span class="label">${escapeHtml(label)}</span> ${escapeHtml(value)}</div>`;
  let duration = '';
  // Under a minute there is nothing useful to show (no "0 min").
  if (state.durationMs !== null && state.durationMs >= 60_000) {
    const { hours, minutes } = durationParts(state.durationMs);
    duration = line('duration', labels.duration, labels.durationValue(hours, minutes));
  }
  return (
    `<section class="results" data-status="${state.status}">` +
    `<h2>${escapeHtml(labels.heading)}</h2>` +
    `<div class="final">${escapeHtml(status)}</div>` +
    line('sets-won', labels.setsWon, `${state.setsWon.us}:${state.setsWon.them}`) +
    `<ul class="set-scores">${sets}</ul>` +
    duration +
    `</section>`
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
.role { float: right; font-weight: 700; color: ${c.text}; }
.off { font-weight: 800; }
p.off-note { margin: 4px 0 0; font-size: ${l.smallFontSize}; color: ${c.textMuted}; }
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
section.results { break-inside: avoid; page-break-inside: avoid; border: 1px solid ${c.border};
  padding: ${l.setPadding}; margin-bottom: ${l.sectionGap}; font-size: ${l.infoFontSize}; }
.final { font-size: ${l.headingFontSize}; font-weight: 700; margin-bottom: 2px; }
ul.set-scores { display: flex; flex-wrap: wrap; gap: 2px 18px; list-style: none; margin: 2px 0; padding: 0; }
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

  const resultsHtml =
    input.withResults && hasResults(match)
      ? renderResults(getMatchState(match), labels.results)
      : '';

  const offNote = sets.some((s) => hasOffPosition(s, byId))
    ? `<p class="off-note">${escapeHtml(labels.offPositionNote)}</p>`
    : '';
  const setsHtml =
    sets.length > 0
      ? `<div class="sets">${sets.map((s) => renderSet(s, byId, labels)).join('')}</div>${offNote}`
      : `<p class="empty">${escapeHtml(labels.noSets)}</p>`;

  return (
    `<!DOCTYPE html><html lang="${escapeHtml(input.lang ?? 'en')}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(labels.documentTitle)}</title><style>${CSS}</style></head><body>` +
    `<header><h1>${escapeHtml(team.name)}</h1><dl class="meta">${metaHtml}</dl></header>` +
    `<main>${resultsHtml}${setsHtml}<section class="roster-section"><h2>${escapeHtml(labels.roster)}</h2>` +
    `${renderRoster(roster, labels)}</section></main></body></html>`
  );
}
