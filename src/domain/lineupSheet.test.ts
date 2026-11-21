import { emptySetLineup } from './lineup';
import {
  buildLineupSheetHtml,
  escapeHtml,
  playerName,
  SHEET_ROWS,
  type LineupSheetLabels,
} from './lineupSheet';
import type { Match, Player, SetLineup, Team } from './types';

const labels: LineupSheetLabels = {
  documentTitle: 'Lineup · Tigers vs Eagles',
  opponent: 'Opponent',
  date: 'Date',
  venue: 'Venue',
  home: 'Home',
  away: 'Away',
  season: 'Season',
  setTitle: (n) => `Set ${n}`,
  net: 'Net',
  positionShort: (n) => `P${n}`,
  emptySlot: '—',
  unknownPlayer: 'Unknown player',
  libero: 'Libero:',
  noLibero: 'none',
  liberoReplaces: (numbers) => `Libero replaces ${numbers}`,
  serveFirst: 'First serve:',
  weServe: 'We serve',
  weReceive: 'We receive',
  server: '(serves)',
  noSets: 'No lineups yet.',
  roster: 'Roster',
  number: '#',
  name: 'Name',
  positions: 'Positions',
  status: 'Status',
  inactive: 'Injured',
  noPlayers: 'No players yet.',
};

const team: Team = { id: 't1', profileId: 'p1', name: 'Tigers', season: '2026', createdAt: '' };

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
  mk('a', 1, 'Anna', 'Setter', { positions: ['S'] }),
  mk('b', 2, 'Bea', 'Outside'),
  mk('c', 3, 'Cleo', 'Middle', { positions: ['MB', 'OPP'] }),
  mk('d', 4, 'Dana', 'Oppo', { positions: ['OPP'] }),
  mk('e', 5, 'Eva', 'Outside'),
  mk('f', 6, 'Fay', 'Middle', { positions: ['MB'] }),
  mk('g', 7, 'Gina', 'Libero', { positions: ['L'], active: false }),
  mk('x', 99, 'Other', 'Team', { teamId: 't2' }),
];

const full = (setNumber: SetLineup['setNumber'], weServeFirst: boolean): SetLineup => ({
  ...emptySetLineup(setNumber),
  slots: { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' },
  liberoId: 'g',
  weServeFirst,
});

const match: Match = {
  id: 'm1',
  teamId: 't1',
  opponent: 'Eagles',
  date: '2026-11-21',
  home: true,
  sets: [full(3, true), full(1, true), full(2, false)],
};

const sectionOf = (html: string, set: number) => {
  const start = html.indexOf(`<section class="set" data-set="${set}">`);
  return html.slice(start, html.indexOf('</section>', start));
};
const cellOf = (section: string, pos: number) => {
  const start = section.indexOf(`data-position="${pos}"`);
  return section.slice(start, section.indexOf('</td>', start));
};

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    );
    expect(escapeHtml('plain')).toBe('plain');
  });
});

describe('playerName', () => {
  it('joins first and last name', () => {
    expect(playerName(players[0])).toBe('Anna Setter');
    expect(playerName(mk('z', 0, 'Solo', ''))).toBe('Solo');
  });
});

describe('buildLineupSheetHtml', () => {
  const html = buildLineupSheetHtml({ match, team, players, labels });

  it('is a self-contained, light, A4 HTML document', () => {
    expect(html.startsWith('<!DOCTYPE html><html lang="en">')).toBe(true);
    expect(html).toContain('<title>Lineup · Tigers vs Eagles</title>');
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('background: #FFFFFF; color: #000000;');
    expect(html).not.toMatch(/<script|<link|src=/);
  });

  it('shows team, opponent, date, venue and season in the header', () => {
    expect(html).toContain('<h1>Tigers</h1>');
    expect(html).toContain('<dt>Opponent</dt><dd>Eagles</dd>');
    expect(html).toContain('<dt>Date</dt><dd>2026-11-21</dd>');
    expect(html).toContain('<dt>Venue</dt><dd>Home</dd>');
    expect(html).toContain('<dt>Season</dt><dd>2026</dd>');
    const away = buildLineupSheetHtml({
      match: { ...match, home: false },
      team: { ...team, season: undefined },
      players,
      labels,
      lang: 'de',
    });
    expect(away).toContain('<html lang="de">');
    expect(away).toContain('<dd>Away</dd>');
    expect(away).not.toContain('Season');
  });

  it('contains every stored set, in order', () => {
    const order = [1, 2, 3].map((n) => html.indexOf(`data-set="${n}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).not.toContain('data-set="4"');
    expect(html).toContain('<h2>Set 2</h2>');
  });

  it('lays each court out as 4-3-2 over 5-6-1 with numbers and names', () => {
    expect(SHEET_ROWS).toEqual([
      [4, 3, 2],
      [5, 6, 1],
    ]);
    const set1 = sectionOf(html, 1);
    const positions = [...set1.matchAll(/data-position="(\d)"/g)].map((m) => Number(m[1]));
    expect(positions).toEqual([4, 3, 2, 5, 6, 1]);
    expect(set1.indexOf('Net')).toBeLessThan(set1.indexOf('data-position="4"'));
    expect(cellOf(set1, 4)).toContain(
      '<span class="num">4</span><span class="name">Dana Oppo</span>',
    );
    expect(cellOf(set1, 4)).toContain('P4');
  });

  it('shows the libero and who serves first per set', () => {
    const set1 = sectionOf(html, 1);
    expect(set1).toContain(
      'Libero:</span> <span class="num">7</span><span class="name">Gina Libero',
    );
    expect(set1).toContain('First serve:</span> We serve');
    expect(cellOf(set1, 1)).toContain('(serves)');
    expect(set1).toContain('<td class="cell serving" data-position="1">');
    const set2 = sectionOf(html, 2);
    expect(set2).toContain('First serve:</span> We receive');
    expect(set2).not.toContain('(serves)');
  });

  it('lists whom the libero replaces, by jersey number', () => {
    const withSwaps: SetLineup = { ...full(1, true), liberoReplaces: ['c', 'ghost', 'f'] };
    const out = buildLineupSheetHtml({
      match: { ...match, sets: [withSwaps] },
      team,
      players,
      labels,
    });
    expect(sectionOf(out, 1)).toContain('<div class="replaces">Libero replaces #3, #6</div>');
    // Not shown without a libero, without replacements, or when no replaced player is known.
    expect(html).not.toContain('class="replaces"');
    for (const set of [
      { ...withSwaps, liberoId: null },
      { ...withSwaps, liberoReplaces: ['ghost'] },
    ]) {
      const other = buildLineupSheetHtml({
        match: { ...match, sets: [set] },
        team,
        players,
        labels,
      });
      expect(other).not.toContain('class="replaces"');
    }
  });

  it('keeps each set on one page but lets a long roster break across pages', () => {
    expect(html).toMatch(/\.set \{ break-inside: avoid;/);
    expect(html).toMatch(/section\.roster-section \{ margin-top: [^;]+; \}/);
    expect(html).toContain('height: 44px;');
  });

  it('marks empty slots, missing libero and unknown players', () => {
    const partial: SetLineup = {
      ...emptySetLineup(1),
      slots: { 1: 'ghost', 2: null, 3: null, 4: null, 5: null, 6: null },
    };
    const out = buildLineupSheetHtml({
      match: { ...match, sets: [partial] },
      team,
      players,
      labels,
    });
    const set = sectionOf(out, 1);
    expect(cellOf(set, 1)).toContain('Unknown player');
    expect(cellOf(set, 2)).toContain('<span class="empty">—</span>');
    expect(set).toContain('<span class="empty">none</span>');
    const unknownLibero = buildLineupSheetHtml({
      match: { ...match, sets: [{ ...partial, liberoId: 'ghost' }] },
      team,
      players,
      labels,
    });
    expect(sectionOf(unknownLibero, 1)).toMatch(
      /Libero:<\/span> <span class="empty">Unknown player/,
    );
  });

  it('lists the team roster sorted by number with positions and status', () => {
    const roster = html.slice(html.indexOf('<table class="roster">'));
    expect(roster).toContain(
      '<tr><td class="n">1</td><td>Anna Setter</td><td>S</td><td></td></tr>',
    );
    expect(roster).toContain('<td>MB, OPP</td>');
    expect(roster).toContain('<td>Gina Libero</td><td>L</td><td>Injured</td>');
    expect(roster).not.toContain('Other Team');
    const nums = [...roster.matchAll(/<td class="n">(\d+)<\/td>/g)].map((m) => Number(m[1]));
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('shows placeholders when there are no sets or players', () => {
    const out = buildLineupSheetHtml({ match: { ...match, sets: [] }, team, players: [], labels });
    expect(out).toContain('No lineups yet.');
    expect(out).toContain('No players yet.');
    expect(out).not.toContain('<table class="roster">');
  });

  it('escapes all user text against HTML injection', () => {
    const evil = '<img src=x onerror="alert(1)">';
    const out = buildLineupSheetHtml({
      match: { ...match, opponent: `${evil}&`, date: '<b>', sets: [full(1, true)] },
      team: { ...team, name: `<script>alert('t')</script>`, season: '"s"' },
      players: players.map((p) =>
        p.id === 'a' ? { ...p, firstName: evil, lastName: '</td>' } : p,
      ),
      labels: { ...labels, documentTitle: '</title><script>x()</script>' },
      lang: '"><script>',
    });
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<b>');
    expect(out).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;');
    expect(out).toContain('&lt;script&gt;alert(&#39;t&#39;)&lt;/script&gt;');
    expect(out).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &lt;/td&gt;');
    expect(out).toContain('&quot;s&quot;');
  });
});
