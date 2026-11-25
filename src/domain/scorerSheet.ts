/**
 * v9.2: the player list for the scorer ("Schreiber"): a printable HTML page (light print theme,
 * A4 portrait) with the team's active players by jersey number — No. · Last name · First name ·
 * marks ("C" for the team captain, "L" for a libero) — to hand to the person who fills in the
 * official scoresheet. Made from a match it also names the opponent, date, season / tournament
 * and home / away.
 *
 * Pure: no React, no i18n import. Translated labels come in through `labels`, and every piece of
 * user text (names, team, opponent, season) is HTML-escaped. Shares the lineup sheet's style
 * sheet (`lineupSheetCss.ts`) and adds its own large table.
 */
import { formatDate } from './dates';
import { escapeHtml } from './html';
import { LINEUP_SHEET_CSS } from './lineupSheetCss';
import type { Match, Player, Season, Team } from './types';
import { printColors as c } from '../theme/print';

export interface ScorerSheetLabels {
  /** Document / PDF title, e.g. "Player list · Tigers". */
  documentTitle: string;
  /** Heading above the team name, e.g. "Player list". */
  title: string;
  /** e.g. "vs Eagles". */
  versus: (opponent: string) => string;
  home: string;
  away: string;
  number: string;
  lastName: string;
  firstName: string;
  /** Header of the marks column (C / L). */
  marks: string;
  captain: string;
  libero: string;
  /** e.g. "C = captain · L = libero". */
  legend: string;
  /** e.g. "2 injured players not listed" (`count` ≥ 1). */
  leftOut: (count: number) => string;
  noPlayers: string;
}

export interface ScorerSheetInput {
  team: Team;
  /** Players of the team (others are ignored). */
  players: Player[];
  /** When printed from a match: adds the match line. */
  match?: Match;
  /** The match's season / tournament (its name goes on the match line). */
  season?: Season;
  labels: ScorerSheetLabels;
  /** `lang` attribute of the document (default `en`). */
  lang?: string;
}

/** Large, easy-to-read table: fits about 20 players on one A4 page, then flows on. */
const SCORER_CSS = `
.kicker { font-size: 12pt; font-weight: 600; color: ${c.textMuted}; margin: 0 0 2px;
  text-transform: uppercase; letter-spacing: 1px; }
p.match { margin: 2px 0 0; font-size: 12pt; font-weight: 600; }
table.scorer { width: 100%; border-collapse: collapse; font-size: 15pt; line-height: 1.2; }
table.scorer thead { display: table-header-group; }
table.scorer tr { break-inside: avoid; page-break-inside: avoid; }
table.scorer th, table.scorer td { border: 1px solid ${c.border}; padding: 6px 10px; text-align: left; }
table.scorer th { background: ${c.fill}; font-size: 11pt; }
table.scorer td.n { width: 3.5em; font-weight: 800; font-size: 18pt; text-align: center; }
table.scorer td.marks { width: 4.5em; font-weight: 800; text-align: center; }
table.scorer th.n, table.scorer th.marks { text-align: center; }
p.note { margin: 6px 0 0; font-size: 10pt; color: ${c.textMuted}; }
`;

/** "C", "L" or "C L" for a player. */
function marks(player: Player, captainId: string | undefined, labels: ScorerSheetLabels): string {
  const out: string[] = [];
  if (player.id === captainId) out.push(labels.captain);
  if (player.positions.includes('L')) out.push(labels.libero);
  return out.join(' ');
}

/** "vs Eagles · 20.11.26 · 2026/27 · Away". */
function matchLine(match: Match, season: Season | undefined, labels: ScorerSheetLabels): string {
  const parts = [labels.versus(match.opponent), formatDate(match.date)];
  if (season) parts.push(season.name);
  parts.push(match.home ? labels.home : labels.away);
  return parts.join(' · ');
}

/** The team's active players sorted by jersey number. */
export function scorerPlayers(team: Team, players: Player[]): Player[] {
  return players
    .filter((p) => p.teamId === team.id && p.active)
    .sort((a, b) => a.number - b.number);
}

/** Builds the printable HTML page of the player list for the scorer. */
export function buildScorerSheetHtml(input: ScorerSheetInput): string {
  const { team, labels, match } = input;
  const listed = scorerPlayers(team, input.players);
  const leftOut = input.players.filter((p) => p.teamId === team.id && !p.active).length;

  const rows = listed
    .map(
      (p) =>
        `<tr><td class="n">${p.number}</td><td>${escapeHtml(p.lastName.trim())}</td>` +
        `<td>${escapeHtml(p.firstName.trim())}</td>` +
        `<td class="marks">${escapeHtml(marks(p, team.captainId, labels))}</td></tr>`,
    )
    .join('');
  const table =
    listed.length > 0
      ? `<table class="scorer"><thead><tr><th class="n">${escapeHtml(labels.number)}</th>` +
        `<th>${escapeHtml(labels.lastName)}</th><th>${escapeHtml(labels.firstName)}</th>` +
        `<th class="marks">${escapeHtml(labels.marks)}</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="empty">${escapeHtml(labels.noPlayers)}</p>`;
  const notes = [
    ...(listed.length > 0 ? [labels.legend] : []),
    ...(leftOut > 0 ? [labels.leftOut(leftOut)] : []),
  ]
    .map((n) => `<p class="note">${escapeHtml(n)}</p>`)
    .join('');
  const matchHtml = match
    ? `<p class="match">${escapeHtml(matchLine(match, input.season, labels))}</p>`
    : '';

  return (
    `<!DOCTYPE html><html lang="${escapeHtml(input.lang ?? 'en')}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(labels.documentTitle)}</title>` +
    `<style>${LINEUP_SHEET_CSS}${SCORER_CSS}</style></head><body>` +
    `<header><p class="kicker">${escapeHtml(labels.title)}</p>` +
    `<h1>${escapeHtml(team.name)}</h1>${matchHtml}</header>` +
    `<main>${table}${notes}</main></body></html>`
  );
}
