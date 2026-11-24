/**
 * Printable lineup sheet (v2 feature 5): builds a self-contained HTML document (inline CSS,
 * light print theme, A4 portrait) for a match — header, every stored set's starting six in court
 * layout (net on top, front row 4-3-2, back row 5-6-1), libero, who serves first, and the roster.
 * Optionally (v3, `withResults`) a played match gets a results section above the sets.
 * v4: every spot shows its role (e.g. "S", "OPP"; v6: from the set's formation, also on an empty
 * spot; "*" when it is none of the player's positions, explained in a note under the sets), and a
 * switched-off libero says so.
 * v9.1: the team captain gets "(C)" after the name, on court, as libero and in the roster.
 *
 * Pure: no React, no i18n import. Translated labels come in through `labels`, and every piece of
 * user text (names, team, opponent, season, labels) is HTML-escaped.
 *
 * v8.3: the style sheet (`lineupSheetCss.ts`), the results section (`lineupSheetResults.ts`) and
 * the HTML escaping (`html.ts`) live in their own modules; this one lays out the sets and roster.
 */
import { formatDate } from './dates';
import { escapeHtml } from './html';
import { LINEUP_SHEET_CSS } from './lineupSheetCss';
import { hasResults, renderResults, type LineupSheetResultLabels } from './lineupSheetResults';
import { getMatchState } from './matchState';
import { fullName } from './playerNames';
import { isOffPosition, roleOf, spotRole } from './roles';
import { COURT_ROWS } from './rotation';
import type { CourtPosition, Match, Player, SetLineup, Team } from './types';

export { escapeHtml } from './html';
export { hasResults, type LineupSheetResultLabels } from './lineupSheetResults';

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
  /** v9.1: after the team captain's name, e.g. "(C)". */
  captainMark: string;
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

/** What the sheet needs besides the set: the players by id, the labels and the captain. */
interface SheetContext {
  byId: Map<string, Player>;
  labels: LineupSheetLabels;
  captainId: string | undefined;
}

/** The player's full name, with the captain mark for the team captain (v9.1). */
function nameText(player: Player, ctx: SheetContext): string {
  const name = fullName(player);
  return player.id === ctx.captainId ? `${name} ${ctx.labels.captainMark}` : name;
}

function playerCell(player: Player | undefined, id: string | null, ctx: SheetContext) {
  const { labels } = ctx;
  if (!id) return `<span class="empty">${escapeHtml(labels.emptySlot)}</span>`;
  if (!player) return `<span class="empty">${escapeHtml(labels.unknownPlayer)}</span>`;
  return (
    `<span class="num">${player.number}</span>` +
    `<span class="name">${escapeHtml(nameText(player, ctx))}</span>`
  );
}

/** The role code of a spot (e.g. "S"), with "*" when the known player on it is off position. */
function roleTag(set: SetLineup, position: CourtPosition, player: Player | undefined): string {
  const role = spotRole(set.formation, position);
  const off = player && isOffPosition(player, role) ? '<span class="off">*</span>' : '';
  return `<span class="role">${escapeHtml(role)}${off}</span>`;
}

/** True when a known starter of the set plays a role that is none of their positions. */
function hasOffPosition(set: SetLineup, byId: Map<string, Player>): boolean {
  return Object.values(set.slots).some((id) => {
    const player = id ? byId.get(id) : undefined;
    return player !== undefined && isOffPosition(player, roleOf(set, player.id));
  });
}

function renderSet(set: SetLineup, ctx: SheetContext): string {
  const { byId, labels } = ctx;
  const rows = COURT_ROWS.map((row) => {
    const cells = row.map((pos) => {
      const id = set.slots[pos];
      const player = id ? byId.get(id) : undefined;
      const serving = pos === 1 && set.weServeFirst;
      const tag = serving ? ` <span class="srv">${escapeHtml(labels.server)}</span>` : '';
      return (
        `<td class="cell${serving ? ' serving' : ''}" data-position="${pos}">` +
        `<span class="pos">${roleTag(set, pos, player)}` +
        `${escapeHtml(labels.positionShort(pos))}${tag}</span>` +
        `${playerCell(player, id, ctx)}</td>`
      );
    });
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  const libero = set.liberoId
    ? playerCell(byId.get(set.liberoId), set.liberoId, ctx)
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

function renderRoster(players: Player[], ctx: SheetContext): string {
  const { labels } = ctx;
  if (players.length === 0) return `<p class="empty">${escapeHtml(labels.noPlayers)}</p>`;
  const body = players
    .map(
      (p) =>
        `<tr><td class="n">${p.number}</td><td>${escapeHtml(nameText(p, ctx))}</td>` +
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

/** Builds the full printable HTML document for a match. */
export function buildLineupSheetHtml(input: LineupSheetInput): string {
  const { match, team, labels } = input;
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const ctx: SheetContext = { byId, labels, captainId: team.captainId };
  const roster = input.players
    .filter((p) => p.teamId === team.id)
    .sort((a, b) => a.number - b.number);
  const sets = [...match.sets].sort((a, b) => a.setNumber - b.setNumber);

  const meta: [string, string][] = [
    [labels.opponent, match.opponent],
    [labels.date, formatDate(match.date)],
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

  // On the roster heading's line (floated right), so it adds no height to the page.
  const offNote = sets.some((s) => hasOffPosition(s, byId))
    ? `<p class="off-note">${escapeHtml(labels.offPositionNote)}</p>`
    : '';
  const setsHtml =
    sets.length > 0
      ? `<div class="sets">${sets.map((s) => renderSet(s, ctx)).join('')}</div>`
      : `<p class="empty">${escapeHtml(labels.noSets)}</p>`;

  return (
    `<!DOCTYPE html><html lang="${escapeHtml(input.lang ?? 'en')}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(labels.documentTitle)}</title><style>${LINEUP_SHEET_CSS}</style></head><body>` +
    `<header><h1>${escapeHtml(team.name)}</h1><dl class="meta">${metaHtml}</dl></header>` +
    `<main>${resultsHtml}${setsHtml}<section class="roster-section">${offNote}` +
    `<h2>${escapeHtml(labels.roster)}</h2>` +
    `${renderRoster(roster, ctx)}</section></main></body></html>`
  );
}
