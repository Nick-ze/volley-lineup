/**
 * v12.3: the table of a hosted tournament as a printable HTML page (light print theme, A4
 * portrait) — to read the final standings out at the end of the day or to pin up: the ranks with
 * the table points in large type, and under them every match with its sets.
 *
 * Pure: no React, no i18n import. Translated labels come in through `labels`, and every piece of
 * user text (tournament, place, team names) is HTML-escaped. Shares the lineup sheet's base style
 * sheet (`lineupSheetCss.ts`).
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import { formatOptionalDate } from './dates';
import { drawsPossible } from './hostedResult';
import type { PlanMatch, PlanRound, Standing, TournamentPlan } from './hostedStandings';
import { escapeHtml } from './html';
import { LINEUP_SHEET_CSS } from './lineupSheetCss';
import type { HostedTournament } from './types';
import { printColors as c } from '../theme/print';

export interface TournamentSheetLabels {
  /** Document / PDF title, e.g. "Table · Winter Cup". */
  documentTitle: string;
  /** Heading above the tournament's name once every match is played, e.g. "Final table". */
  finalTitle: string;
  /** The same while matches are open, e.g. "Table". */
  interimTitle: string;
  /** e.g. "9 of 15 matches played". */
  progress: (played: number, total: number) => string;
  /** The tournament's format, e.g. "best of 3". */
  format: string;
  rank: string;
  team: string;
  played: string;
  /** Header of the record column: "W–L". */
  record: string;
  /** The same where a match can end in a draw: "W–D–L". */
  recordWithDraws: string;
  sets: string;
  balls: string;
  points: string;
  recordText: (won: number, lost: number) => string;
  recordWithDrawsText: (won: number, drawn: number, lost: number) => string;
  /** Two numbers of one kind, e.g. "7:3". */
  score: (a: number, b: number) => string;
  /** A difference with its sign, e.g. "+24". */
  signed: (n: number) => string;
  /** The ranking rule in a sentence. */
  explain: string;
  /** Heading of the list of matches, e.g. "Results". */
  results: string;
  /** e.g. "Round 3" (round robin only). */
  round: (n: number) => string;
  /** e.g. "TV Nord rests". */
  resting: (team: string) => string;
  /** Between the two teams of a match. */
  versus: string;
  notPlayed: string;
  notFinished: string;
}

export interface TournamentSheetInput {
  tournament: HostedTournament;
  /** The table, in its order (`standings`). */
  standings: readonly Standing[];
  /** The plan with every match's result (`tournamentPlan`). */
  plan: TournamentPlan;
  labels: TournamentSheetLabels;
  /** `lang` attribute of the document (default `en`). */
  lang?: string;
}

/** Large rows: sixteen teams and their points read from two steps away, on one A4 page. */
const SHEET_CSS = `
.kicker { font-size: 12pt; font-weight: 600; color: ${c.textMuted}; margin: 0 0 2px;
  text-transform: uppercase; letter-spacing: 1px; }
p.meta { margin: 2px 0 0; font-size: 12pt; font-weight: 600; }
table.standings { width: 100%; border-collapse: collapse; font-size: 13pt; line-height: 1.2; }
table.standings thead { display: table-header-group; }
table.standings tr { break-inside: avoid; page-break-inside: avoid; }
table.standings th, table.standings td { border: 1px solid ${c.border}; padding: 6px 8px;
  text-align: center; white-space: nowrap; }
table.standings th { background: ${c.fill}; font-size: 10pt; }
table.standings th.team, table.standings td.team { text-align: left; white-space: normal;
  width: 100%; }
table.standings td.rank { font-weight: 800; font-size: 17pt; }
table.standings td.team { font-weight: 700; font-size: 15pt; }
table.standings td.points { font-weight: 800; font-size: 19pt; }
p.note { margin: 6px 0 0; font-size: 10pt; color: ${c.textMuted}; }
section.matches { margin-top: 16px; }
section.matches h2 { margin: 0 0 4px; break-after: avoid; page-break-after: avoid; }
table.matches { width: 100%; border-collapse: collapse; font-size: 11pt; line-height: 1.25; }
table.matches tr { break-inside: avoid; page-break-inside: avoid; }
/* A round stays on one page, and its heading is never the last line of a page. */
table.matches tbody.round { break-inside: avoid; page-break-inside: avoid; }
table.matches tr.heading { break-after: avoid; page-break-after: avoid; }
table.matches td, table.matches th { border-bottom: 1px solid ${c.grid}; padding: 3px 6px;
  text-align: left; vertical-align: baseline; }
table.matches th.round { background: ${c.fill}; font-size: 10pt; }
table.matches th.round span { font-weight: 400; margin-left: 10px; }
table.matches td.n { width: 2.2em; text-align: right; color: ${c.textMuted}; }
table.matches td.res { width: 3.2em; font-weight: 800; text-align: center; white-space: nowrap; }
table.matches td.scores { white-space: nowrap; }
table.matches .muted { color: ${c.textMuted}; }
`;

/** One row of the table. */
function standingRow(row: Standing, withDraws: boolean, labels: TournamentSheetLabels): string {
  const record = withDraws
    ? labels.recordWithDrawsText(row.won, row.drawn, row.lost)
    : labels.recordText(row.won, row.lost);
  const cells = [
    row.played,
    record,
    labels.score(row.setsFor, row.setsAgainst),
    labels.signed(row.ballsFor - row.ballsAgainst),
  ];
  return (
    `<tr><td class="rank">${row.rank}</td><td class="team">${escapeHtml(row.team.name)}</td>` +
    cells.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('') +
    `<td class="points">${row.points}</td></tr>`
  );
}

/** A team's name, bold when it won the match. */
const teamName = (name: string, won: boolean): string =>
  won ? `<b>${escapeHtml(name)}</b>` : escapeHtml(name);

/** One match: its number, the two teams, the sets won and every set's score. */
function matchRow(match: PlanMatch, labels: TournamentSheetLabels): string {
  const { outcome, sets } = match;
  const pair =
    teamName(match.teamA.name, outcome.winner === 'a') +
    escapeHtml(labels.versus) +
    teamName(match.teamB.name, outcome.winner === 'b');
  const scores = sets.map((set) => labels.score(set.a, set.b)).join(', ');
  const [result, detail] =
    sets.length === 0
      ? ['', `<span class="muted">${escapeHtml(labels.notPlayed)}</span>`]
      : [
          labels.score(outcome.setsA, outcome.setsB),
          escapeHtml(scores) +
            (outcome.state === 'done'
              ? ''
              : ` <span class="muted">${escapeHtml(labels.notFinished)}</span>`),
        ];
  return (
    `<tr><td class="n">${match.number}</td><td class="pair">${pair}</td>` +
    `<td class="res">${escapeHtml(result)}</td><td class="scores">${detail}</td></tr>`
  );
}

/**
 * A round's matches as one table body. A round robin's round has a heading and stays on one
 * page; a tournament with own matches is one long list that may break anywhere between rows.
 */
function roundBody(round: PlanRound, isRound: boolean, labels: TournamentSheetLabels): string {
  const rows = round.matches.map((match) => matchRow(match, labels)).join('');
  if (!isRound) return `<tbody>${rows}</tbody>`;
  const resting =
    round.resting === null ? '' : `<span>${escapeHtml(labels.resting(round.resting.name))}</span>`;
  return (
    `<tbody class="round"><tr class="heading"><th class="round" colspan="4">` +
    `${escapeHtml(labels.round(round.round))}${resting}</th></tr>${rows}</tbody>`
  );
}

/** "05.12.26 · Halle Süd · best of 3 · 9 of 15 matches played". */
function metaLine(input: TournamentSheetInput): string {
  const { tournament, plan, labels } = input;
  return [
    formatOptionalDate(tournament.date),
    (tournament.location ?? '').trim(),
    labels.format,
    plan.total > 0 ? labels.progress(plan.played, plan.total) : '',
  ]
    .filter((part) => part !== '')
    .join(' · ');
}

/** Every match of the plan is played (and there is at least one). */
export const isFinalTable = (plan: Pick<TournamentPlan, 'total' | 'played'>): boolean =>
  plan.total > 0 && plan.played === plan.total;

/** Builds the printable HTML page of a hosted tournament's table and results. */
export function buildTournamentSheetHtml(input: TournamentSheetInput): string {
  const { tournament, standings, plan, labels } = input;
  const withDraws = drawsPossible(tournament) || standings.some((row) => row.drawn > 0);
  const headers = [
    labels.played,
    withDraws ? labels.recordWithDraws : labels.record,
    labels.sets,
    labels.balls,
  ];
  const table =
    `<table class="standings"><thead><tr><th>${escapeHtml(labels.rank)}</th>` +
    `<th class="team">${escapeHtml(labels.team)}</th>` +
    headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('') +
    `<th>${escapeHtml(labels.points)}</th></tr></thead><tbody>` +
    standings.map((row) => standingRow(row, withDraws, labels)).join('') +
    `</tbody></table><p class="note">${escapeHtml(labels.explain)}</p>`;
  const matches =
    plan.total > 0
      ? `<section class="matches"><h2>${escapeHtml(labels.results)}</h2><table class="matches">` +
        plan.rounds.map((round) => roundBody(round, plan.kind === 'roundRobin', labels)).join('') +
        `</table></section>`
      : '';
  const title = isFinalTable(plan) ? labels.finalTitle : labels.interimTitle;

  return (
    `<!DOCTYPE html><html lang="${escapeHtml(input.lang ?? 'en')}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(labels.documentTitle)}</title>` +
    `<style>${LINEUP_SHEET_CSS}${SHEET_CSS}</style></head><body>` +
    `<header><p class="kicker">${escapeHtml(title)}</p>` +
    `<h1>${escapeHtml(tournament.name)}</h1>` +
    `<p class="meta">${escapeHtml(metaLine(input))}</p></header>` +
    `<main>${table}${matches}</main></body></html>`
  );
}
