import { buildScorerSheetHtml, scorerPlayers, type ScorerSheetLabels } from './scorerSheet';
import type { Match, Player, Season, Team } from './types';
import { de } from '../i18n/de';
import { en } from '../i18n/en';

const labelsFor = (s: typeof en.print.scorer.sheet, team: string): ScorerSheetLabels => ({
  ...s,
  documentTitle: s.documentTitle(team),
});
const labels = labelsFor(en.print.scorer.sheet, 'Tigers');

const team: Team = { id: 't1', profileId: 'p1', name: 'Tigers', createdAt: '', captainId: 'p12' };

const mk = (id: string, number: number, first: string, last: string, extra: Partial<Player> = {}) =>
  ({
    id,
    teamId: 't1',
    firstName: first,
    lastName: last,
    number,
    positions: ['OH'],
    active: true,
    ...extra,
  }) satisfies Player;

const players: Player[] = [
  mk('p12', 12, 'Anna', 'Meier'),
  mk('p3', 3, 'Ben', 'Berg', { positions: ['L'] }),
  mk('p7', 7, 'Cleo', 'Zorn', { active: false }),
  mk('p1', 1, ' Dana ', ' Albers ', { positions: ['S', 'L'] }),
  mk('px', 2, 'Other', 'Team', { teamId: 't2' }),
];

const match: Match = {
  id: 'm1',
  teamId: 't1',
  seasonId: 's1',
  opponentId: 'o1',
  opponent: 'Eagles',
  date: '2026-11-20',
  home: false,
  sets: [],
};
const season: Season = { id: 's1', teamId: 't1', name: '2026/27', kind: 'season', createdAt: '' };

/** The table rows as "number|last|first|marks". */
function rows(html: string): string[] {
  return [
    ...html.matchAll(
      /<tr><td class="n">(\d+)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><td class="marks">(.*?)<\/td><\/tr>/g,
    ),
  ].map((m) => m.slice(1).join('|'));
}

describe('scorerPlayers', () => {
  it('keeps only the team’s active players, by jersey number', () => {
    expect(scorerPlayers(team, players).map((p) => p.id)).toEqual(['p1', 'p3', 'p12']);
  });
});

describe('buildScorerSheetHtml', () => {
  it('lists the active players by number with C and L marks, trimmed names', () => {
    const html = buildScorerSheetHtml({ team, players, labels });
    expect(rows(html)).toEqual(['1|Albers|Dana|L', '3|Berg|Ben|L', '12|Meier|Anna|C']);
    expect(html).not.toContain('Zorn'); // injured
    expect(html).not.toContain('Other'); // another team
    expect(html).toContain('<p class="note">1 injured player not listed</p>');
    expect(html).toContain('<p class="note">C = captain · L = libero</p>');
    expect(html).toContain(
      '<th class="n">No.</th><th>Last name</th><th>First name</th><th class="marks">C / L</th>',
    );
  });

  it('marks a libero captain with both', () => {
    const html = buildScorerSheetHtml({ team: { ...team, captainId: 'p3' }, players, labels });
    expect(rows(html)).toContain('3|Berg|Ben|C L');
    expect(rows(html)).toContain('12|Meier|Anna|');
  });

  it('has a title, the team name and no match line without a match', () => {
    const html = buildScorerSheetHtml({ team, players, labels });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Player list · Tigers</title>');
    expect(html).toContain('<p class="kicker">Player list</p><h1>Tigers</h1></header>');
    expect(html).not.toContain('class="match"');
    expect(html).toContain('@page { size: A4 portrait');
  });

  it('adds the match line with opponent, date, season and home / away', () => {
    const away = buildScorerSheetHtml({ team, players, labels, match, season });
    expect(away).toContain('<p class="match">vs Eagles · 20.11.26 · 2026/27 · Away</p>');
    const home = buildScorerSheetHtml({ team, players, labels, match: { ...match, home: true } });
    expect(home).toContain('<p class="match">vs Eagles · 20.11.26 · Home</p>');
  });

  it('says how many injured players are left out, and nothing when none', () => {
    const two = players.map((p) => (p.id === 'p3' ? { ...p, active: false } : p));
    expect(buildScorerSheetHtml({ team, players: two, labels })).toContain(
      '2 injured players not listed',
    );
    const none = players.filter((p) => p.active);
    expect(buildScorerSheetHtml({ team, players: none, labels })).not.toContain('not listed');
  });

  it('shows "No active players." and no legend when nobody is listed', () => {
    const html = buildScorerSheetHtml({ team, players: [], labels });
    expect(html).toContain('<p class="empty">No active players.</p>');
    expect(html).not.toContain('<table class="scorer">');
    expect(html).not.toContain('C = captain');
  });

  it('escapes every piece of user text', () => {
    const evil = '<b>"x" & \'y\'</b>';
    const esc = '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;';
    const html = buildScorerSheetHtml({
      team: { ...team, name: evil },
      players: [mk('p12', 12, evil, evil)],
      labels: labelsFor(en.print.scorer.sheet, evil),
      match: { ...match, opponent: evil },
      season: { ...season, name: evil },
      lang: 'en"',
    });
    expect(html).not.toContain('<b>');
    expect(html).toContain(`<h1>${esc}</h1>`);
    expect(html).toContain(`<title>Player list · ${esc}</title>`);
    expect(html).toContain(`<td>${esc}</td><td>${esc}</td>`);
    expect(html).toContain(`<p class="match">vs ${esc} · 20.11.26 · ${esc} · Away</p>`);
    expect(html).toContain('lang="en&quot;"');
  });

  it('prints in German', () => {
    const html = buildScorerSheetHtml({
      team,
      players,
      labels: labelsFor(de.print.scorer.sheet, 'Tigers'),
      match,
      season,
      lang: 'de',
    });
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<title>Spielerliste · Tigers</title>');
    expect(html).toContain('<th class="n">Nr.</th><th>Name</th><th>Vorname</th>');
    expect(html).toContain('<p class="match">gegen Eagles · 20.11.26 · 2026/27 · Auswärts</p>');
    expect(html).toContain('C = Kapitän · L = Libero');
    expect(html).toContain('1 verletzter Spieler nicht aufgeführt');
    expect(de.print.scorer.sheet.leftOut(3)).toBe('3 verletzte Spieler nicht aufgeführt');
  });
});
