import { buildTournamentSheetHtml, isFinalTable, type TournamentSheetLabels } from './hostedSheet';
import { standings, tournamentPlan } from './hostedStandings';
import type { HostedResult, HostedTeam, HostedTournament } from './types';
import { de } from '../i18n/de';
import { en } from '../i18n/en';

type Strings = typeof en;

const labelsFor = (t: Strings, tournament: HostedTournament): TournamentSheetLabels => ({
  ...t.tournament.sheet,
  documentTitle: t.tournament.sheet.documentTitle(tournament.name),
  format:
    tournament.matchEnd === 'bestOf'
      ? t.tournament.format.bestOf(tournament.setsPerMatch)
      : t.tournament.format.allSets(tournament.setsPerMatch),
  recordText: t.tournament.table.record,
  recordWithDrawsText: t.tournament.table.recordWithDraws,
  signed: t.tournament.signed,
  explain: t.tournament.table.explain[tournament.matchEnd === 'bestOf' ? 'matches' : 'sets'],
  round: t.tournament.matches.round,
  resting: t.tournament.matches.resting,
});

const cup: HostedTournament = {
  id: 'h1',
  profileId: 'p1',
  name: 'Winter Cup',
  date: '2026-12-05',
  location: ' Halle Süd ',
  setsPerMatch: 3,
  matchEnd: 'bestOf',
  plan: 'roundRobin',
  createdAt: '2026-11-01T10:00:00.000Z',
};

const team = (id: string, name: string, order: number, tournamentId = 'h1'): HostedTeam => ({
  id,
  tournamentId,
  name,
  order,
});
const teams = [team('a', 'TV Nord', 0), team('b', 'Rivals', 1), team('c', 'Smash & Co', 2)];

const result = (
  id: string,
  teamAId: string,
  teamBId: string,
  sets: [number, number][],
  extra: Partial<HostedResult> = {},
): HostedResult => ({
  id,
  tournamentId: 'h1',
  teamAId,
  teamBId,
  sets: sets.map(([a, b]) => ({ a, b })),
  ...extra,
});

function sheet(
  tournament: HostedTournament,
  allTeams: HostedTeam[],
  results: HostedResult[],
  t: Strings = en,
  lang?: string,
) {
  return buildTournamentSheetHtml({
    tournament,
    standings: standings(tournament, allTeams, results),
    plan: tournamentPlan(tournament, allTeams, results),
    labels: labelsFor(t, tournament),
    lang,
  });
}

/** The text of the cells of every row of a table, row by row. */
function rows(html: string, table: 'standings' | 'matches'): string[][] {
  const body = html.split(`<table class="${table}">`)[1].split('</table>')[0];
  return [...body.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/g)].map((cell) =>
      cell[1].replace(/<[^>]+>/g, ''),
    ),
  );
}

describe('isFinalTable', () => {
  it('is true only when there are matches and all are played', () => {
    expect(isFinalTable({ total: 0, played: 0 })).toBe(false);
    expect(isFinalTable({ total: 3, played: 2 })).toBe(false);
    expect(isFinalTable({ total: 3, played: 3 })).toBe(true);
  });
});

describe('buildTournamentSheetHtml: a round robin under way', () => {
  const results = [
    result('r1', 'a', 'b', [
      [25, 20],
      [18, 25],
      [15, 12],
    ]),
    // Stored the other way round than the plan shows the pair; one set of a best of 3.
    result('r2', 'c', 'a', [[25, 23]]),
  ];
  const html = sheet(cup, teams, results);

  it('is a whole A4 document in the print theme', () => {
    expect(html.startsWith('<!DOCTYPE html><html lang="en">')).toBe(true);
    expect(html).toContain('<title>Table · Winter Cup</title>');
    expect(html).toContain('size: A4 portrait');
    expect(html.endsWith('</main></body></html>')).toBe(true);
  });

  it('heads the page with "Table", the name, and date, place, format and progress', () => {
    expect(html).toContain('<p class="kicker">Table</p>');
    expect(html).toContain('<h1>Winter Cup</h1>');
    expect(html).toContain(
      '<p class="meta">05.12.26 · Halle Süd · best of 3 · 1 of 3 matches played</p>',
    );
  });

  it('lists the teams by rank with played, record, sets, balls and the points', () => {
    expect(rows(html, 'standings')).toEqual([
      ['Rank', 'Team', 'Played', 'W–L', 'Sets', 'Balls', 'Points'],
      ['1', 'TV Nord', '1', '1–0', '2:1', '+1', '2'],
      ['2', 'Smash &amp; Co', '0', '0–0', '0:0', '0', '0'],
      ['3', 'Rivals', '1', '0–1', '1:2', '−1', '0'],
    ]);
    expect(html).toContain(`<p class="note">${en.tournament.table.explain.matches}</p>`);
  });

  it('lists every match under its round: finished, not finished and not played', () => {
    expect(html).toContain('<h2>Results</h2>');
    expect(rows(html, 'matches')).toEqual([
      ['Round 1TV Nord rests'],
      ['1', 'Rivals – Smash &amp; Co', '', 'not played yet'],
      ['Round 2Rivals rests'],
      ['2', 'TV Nord – Smash &amp; Co', '0:1', '23:25 (not finished)'],
      ['Round 3Smash &amp; Co rests'],
      ['3', 'TV Nord – Rivals', '2:1', '25:20, 18:25, 15:12'],
    ]);
  });

  it('prints only the winner of a finished match in bold', () => {
    expect(html).toContain('<td class="pair"><b>TV Nord</b> – Rivals</td>');
    expect(html).toContain('<td class="pair">TV Nord – Smash &amp; Co</td>');
  });
});

describe('buildTournamentSheetHtml: the final table', () => {
  it('says "Final table" once every match is played; the lower team can be the winner', () => {
    const two = teams.slice(0, 2);
    const html = sheet(cup, two, [
      result('r1', 'a', 'b', [
        [20, 25],
        [19, 25],
      ]),
    ]);
    expect(html).toContain('<p class="kicker">Final table</p>');
    expect(html).toContain('1 of 1 matches played');
    expect(html).toContain('<td class="pair">TV Nord – <b>Rivals</b></td>');
    // Two teams: one round, nobody rests.
    expect(rows(html, 'matches')[0]).toEqual(['Round 1']);
    expect(rows(html, 'standings')[1]).toEqual(['1', 'Rivals', '1', '1–0', '2:0', '+11', '2']);
  });
});

describe('buildTournamentSheetHtml: draws', () => {
  const twoSets: HostedTournament = { ...cup, setsPerMatch: 2, matchEnd: 'allSets' };

  it('shows won–drawn–lost where a match can end in a draw, and no bold name for a draw', () => {
    const html = sheet(twoSets, teams.slice(0, 2), [
      result('r1', 'a', 'b', [
        [25, 20],
        [20, 25],
      ]),
    ]);
    expect(rows(html, 'standings')).toEqual([
      ['Rank', 'Team', 'Played', 'W–D–L', 'Sets', 'Balls', 'Points'],
      ['1', 'Rivals', '1', '0–1–0', '1:1', '0', '1'],
      ['1', 'TV Nord', '1', '0–1–0', '1:1', '0', '1'],
    ]);
    expect(html).toContain('<td class="pair">TV Nord – Rivals</td>');
    expect(html).toContain(' · 2 sets · 1 of 1 matches played</p>');
    expect(html).toContain(`<p class="note">${en.tournament.table.explain.sets}</p>`);
  });

  it('keeps the draw column when the settings changed after a draw was stored', () => {
    // The standings are handed in: a row with a draw in a tournament that no longer allows one.
    const table = standings(twoSets, teams.slice(0, 2), [
      result('r1', 'a', 'b', [
        [25, 20],
        [20, 25],
      ]),
    ]);
    const html = buildTournamentSheetHtml({
      tournament: cup,
      standings: table,
      plan: tournamentPlan(cup, teams.slice(0, 2), []),
      labels: labelsFor(en, cup),
    });
    expect(rows(html, 'standings')[0]).toContain('W–D–L');
  });
});

describe('buildTournamentSheetHtml: own matches', () => {
  const manual: HostedTournament = {
    ...cup,
    id: 'h3',
    name: '<Friendly>',
    date: undefined,
    location: undefined,
    plan: 'manual',
  };
  const own = [team('x', 'Hosts', 0, 'h3'), team('y', 'Guests "B"', 1, 'h3')];
  const match = (id: string, sets: [number, number][], extra: Partial<HostedResult> = {}) => ({
    ...result(id, 'x', 'y', sets, extra),
    tournamentId: 'h3',
  });

  it('numbers the matches without round headings and escapes every name', () => {
    const html = sheet(manual, own, [
      match('m1', [
        [25, 10],
        [25, 12],
      ]),
      match('m2', []),
      // A set being scored live is not a finished set: the match counts as not played yet.
      match('m3', [], { live: [[{ team: 'a' }]] }),
    ]);
    expect(html).toContain('<title>Table · &lt;Friendly&gt;</title>');
    expect(html).toContain('<h1>&lt;Friendly&gt;</h1>');
    expect(html).toContain('<p class="meta">best of 3 · 1 of 3 matches played</p>');
    expect(html).not.toContain('class="round"');
    expect(rows(html, 'matches')).toEqual([
      ['1', 'Hosts – Guests &quot;B&quot;', '2:0', '25:10, 25:12'],
      ['2', 'Hosts – Guests &quot;B&quot;', '', 'not played yet'],
      ['3', 'Hosts – Guests &quot;B&quot;', '', 'not played yet'],
    ]);
  });

  it('has the table only, without progress, while no match was added', () => {
    const html = sheet(manual, own, []);
    expect(html).toContain('<p class="kicker">Table</p>');
    expect(html).toContain('<p class="meta">best of 3</p>');
    expect(html).not.toContain('<section class="matches">');
    expect(rows(html, 'standings')).toHaveLength(3);
  });
});

describe('buildTournamentSheetHtml: German', () => {
  it('uses the German labels and the document language', () => {
    const html = sheet(cup, teams, [], de as Strings, 'de');
    expect(html.startsWith('<!DOCTYPE html><html lang="de">')).toBe(true);
    expect(html).toContain('<title>Tabelle · Winter Cup</title>');
    expect(rows(html, 'standings')[0]).toEqual([
      'Rang',
      'Team',
      'Spiele',
      'S–N',
      'Sätze',
      'Bälle',
      'Punkte',
    ]);
    expect(html).toContain('0 von 3 Spielen gespielt');
    expect(html).toContain('<h2>Ergebnisse</h2>');
    expect(html).toContain('noch nicht gespielt');
  });
});
