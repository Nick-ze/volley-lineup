import { emptySetLineup } from './lineup';
import {
  buildLineupSheetHtml,
  durationParts,
  escapeHtml,
  hasResults,
  playerName,
  SHEET_ROWS,
  type LineupSheetLabels,
} from './lineupSheet';
import type { Match, PointEvent, Player, SetLineup, Side, Team } from './types';

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
  liberoOff: 'Libero off',
  offPositionNote: '* = plays a role that is none of their positions',
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
  results: {
    heading: 'Result',
    won: 'Won',
    lost: 'Lost',
    inProgress: 'In progress',
    setsWon: 'Sets won:',
    setScore: (n, us, them, open) => `Set ${n} ${us}:${them}${open ? ' (in progress)' : ''}`,
    duration: 'Duration:',
    durationValue: (h, m) => (h > 0 ? `${h} h ${m} min` : `${m} min`),
  },
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
  seasonId: 's1',
  opponentId: 'o1',
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

  it('shows each starter’s role in their spot, primary position by default (v4)', () => {
    const set1 = sectionOf(html, 1);
    expect(cellOf(set1, 1)).toContain('<span class="pos"><span class="role">S</span>P1');
    expect(cellOf(set1, 2)).toContain('<span class="role">OH</span>');
    expect(cellOf(set1, 3)).toContain('<span class="role">MB</span>');
    expect(cellOf(set1, 4)).toContain('<span class="role">OPP</span>');
    expect(cellOf(set1, 6)).toContain('<span class="role">MB</span>');
    // The role sits above the player, in the small position line (cell height unchanged).
    expect(cellOf(set1, 4).indexOf('class="role"')).toBeLessThan(
      cellOf(set1, 4).indexOf('class="num"'),
    );
    expect(html).not.toContain('class="off"');
    expect(html).not.toContain('class="off-note"');
  });

  it('marks an off-position role with "*" and explains it once under the sets', () => {
    // v6: roles come from the spots. d (OPP) on the MB spot 6 is off position; c (MB, OPP) on
    // the OPP spot 4 plays a secondary position; f (MB) on the MB spot 3 its primary one.
    const moved: SetLineup = {
      ...full(1, true),
      slots: { 1: 'a', 2: 'b', 3: 'f', 4: 'c', 5: 'e', 6: 'd' },
    };
    const out = buildLineupSheetHtml({
      match: { ...match, sets: [moved, full(2, false)] },
      team,
      players,
      labels,
    });
    const set1 = sectionOf(out, 1);
    expect(cellOf(set1, 6)).toContain('<span class="role">MB<span class="off">*</span></span>');
    expect(cellOf(set1, 4)).toContain('<span class="role">OPP</span>');
    expect(cellOf(set1, 3)).toContain('<span class="role">MB</span>');
    expect(cellOf(sectionOf(out, 2), 6)).toContain('<span class="role">MB</span>');
    expect(out.match(/class="off"/g)).toHaveLength(1);
    expect(out.match(/class="off-note"/g)).toHaveLength(1);
    expect(out).toContain(
      '<section class="roster-section"><p class="off-note">* = plays a role that is none of their positions</p><h2>Roster</h2>',
    );
  });

  it('shows the spot role also on an empty / unknown spot (no "*"); a player without positions is off position', () => {
    const noPos = players.map((p) => (p.id === 'b' ? { ...p, positions: [] } : p));
    const partial: SetLineup = {
      ...full(1, true),
      slots: { 1: 'a', 2: 'b', 3: null, 4: 'ghost', 5: 'e', 6: 'f' },
    };
    const out = buildLineupSheetHtml({
      match: { ...match, sets: [partial] },
      team,
      players: noPos,
      labels,
    });
    const set = sectionOf(out, 1);
    // v6 (PLAN §22 item 2): the formation gives every spot a role, also an empty one.
    expect(cellOf(set, 3)).toContain('<span class="pos"><span class="role">MB</span>P3');
    expect(cellOf(set, 4)).toContain('<span class="pos"><span class="role">OPP</span>P4');
    for (const pos of [3, 4]) expect(cellOf(set, pos)).not.toContain('class="off"');
    expect(cellOf(set, 1)).toContain('<span class="role">S</span>');
    // v6: the spot's role (OH at 2) is none of b's (empty) positions.
    expect(cellOf(set, 2)).toContain('<span class="role">OH<span class="off">*</span></span>');
  });

  it('says "Libero off" instead of whom the libero replaces when switched off', () => {
    const off: SetLineup = { ...full(1, true), liberoReplaces: ['c', 'f'], liberoActive: false };
    const out = buildLineupSheetHtml({ match: { ...match, sets: [off] }, team, players, labels });
    const set = sectionOf(out, 1);
    expect(set).toContain('<div class="libero-off">Libero off</div>');
    expect(set).not.toContain('class="replaces"');
    expect(set).toContain('Libero:</span> <span class="num">7</span>');
    // On: replaces as before. No libero: neither line.
    const on = buildLineupSheetHtml({
      match: { ...match, sets: [{ ...off, liberoActive: true }] },
      team,
      players,
      labels,
    });
    expect(sectionOf(on, 1)).toContain('<div class="replaces">Libero replaces #3, #6</div>');
    expect(sectionOf(on, 1)).not.toContain('libero-off');
    const none = buildLineupSheetHtml({
      match: { ...match, sets: [{ ...off, liberoId: null }] },
      team,
      players,
      labels,
    });
    expect(none).not.toContain('libero-off');
  });

  it('escapes the v4 labels', () => {
    const out = buildLineupSheetHtml({
      match: {
        ...match,
        // b (OH) on the setter spot: off position, so the note is printed.
        sets: [
          {
            ...full(1, true),
            slots: { ...full(1, true).slots, 1: 'b', 2: 'a' },
            liberoActive: false,
          },
        ],
      },
      team,
      players,
      labels: { ...labels, liberoOff: '<b>off</b>', offPositionNote: '<i>*</i> & "x"' },
    });
    expect(out).not.toContain('<b>');
    expect(out).not.toContain('<i>');
    expect(out).toContain('&lt;b&gt;off&lt;/b&gt;');
    expect(out).toContain('&lt;i&gt;*&lt;/i&gt; &amp; &quot;x&quot;');
  });

  it('keeps each set on one page but lets a long roster break across pages', () => {
    expect(html).toMatch(/\.set \{ break-inside: avoid;/);
    expect(html).toMatch(/section\.roster-section \{ margin-top: [^;]+; \}/);
    expect(html).toContain('height: 44px;');
  });

  it('keeps names in court cells and info lines to one line, the results compact (A4 fit)', () => {
    // Long names must not grow the cells (checked with a real A4 PDF in the browser).
    expect(html).toMatch(/\.name \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis; \}/);
    expect(html).toMatch(/\.info > div \{ white-space: nowrap;[^}]*text-overflow: ellipsis; \}/);
    // The results block lays its parts out in a row (one line, wrapping only if needed).
    expect(html).toMatch(/section\.results \{[^}]*display: flex; flex-wrap: wrap;/);
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

/** Rallies of a set: the loser's points first, then the winner's (so the winner scores last). */
function rallies(us: number, them: number, stamps: { first?: string; last?: string } = {}) {
  const side = (winner: Side, n: number) =>
    Array.from({ length: n }, (): PointEvent => ({ type: 'point', winner }));
  const events =
    us >= them
      ? [...side('them', them), ...side('us', us)]
      : [...side('us', us), ...side('them', them)];
  if (stamps.first) events[0] = { ...events[0], at: stamps.first };
  if (stamps.last) events[events.length - 1] = { ...events[events.length - 1], at: stamps.last };
  return events;
}

const played = (setNumber: SetLineup['setNumber'], us: number, them: number, stamps = {}) => ({
  ...full(setNumber, true),
  events: rallies(us, them, stamps),
});

const resultsOf = (html: string) => {
  const start = html.indexOf('<section class="results"');
  return start < 0 ? '' : html.slice(start, html.indexOf('</section>', start));
};

describe('results section (v3)', () => {
  const won31: Match = {
    ...match,
    sets: [
      played(1, 25, 21, { first: '2026-11-21T18:00:00.000Z' }),
      played(2, 22, 25),
      played(3, 25, 18),
      played(4, 26, 24, { last: '2026-11-21T19:32:10.000Z' }),
    ],
  };

  it('prints the final result, sets won, every set score and the duration of a 3:1 win', () => {
    const out = buildLineupSheetHtml({ match: won31, team, players, labels, withResults: true });
    const results = resultsOf(out);
    expect(results).toContain('data-status="won"');
    expect(results).toContain('<h2>Result</h2>');
    expect(results).toContain('<div class="final">Won</div>');
    expect(results).toContain('<span class="label">Sets won:</span> 3:1');
    expect(results).toContain(
      '<ul class="set-scores"><li data-set-result="1">Set 1 25:21</li>' +
        '<li data-set-result="2">Set 2 22:25</li><li data-set-result="3">Set 3 25:18</li>' +
        '<li data-set-result="4">Set 4 26:24</li></ul>',
    );
    expect(results).toContain('<span class="label">Duration:</span> 1 h 32 min');
    // The results come before the lineups; the lineups are still all there.
    expect(out.indexOf('class="results"')).toBeLessThan(out.indexOf('class="sets"'));
    for (const n of [1, 2, 3, 4]) expect(out).toContain(`data-set="${n}"`);
  });

  it('hides a duration under one minute and shows one of exactly a minute', () => {
    const quick = (last: string): Match => ({
      ...match,
      sets: [played(1, 3, 1, { first: '2026-11-21T18:00:00.000Z', last })],
    });
    const html = (m: Match) =>
      resultsOf(buildLineupSheetHtml({ match: m, team, players, labels, withResults: true }));
    expect(html(quick('2026-11-21T18:00:59.999Z'))).not.toContain('Duration');
    expect(html(quick('2026-11-21T18:00:59.999Z'))).not.toContain('0 min');
    expect(html(quick('2026-11-21T18:01:00.000Z'))).toContain(
      '<span class="label">Duration:</span> 1 min',
    );
  });

  it('prints a lost match as lost', () => {
    const lost: Match = {
      ...match,
      sets: [played(1, 10, 25), played(2, 20, 25), played(3, 23, 25)],
    };
    const results = resultsOf(
      buildLineupSheetHtml({ match: lost, team, players, labels, withResults: true }),
    );
    expect(results).toContain('<div class="final">Lost</div>');
    expect(results).toContain('Sets won:</span> 0:3');
  });

  it('marks a match in progress and the open set, without a duration when there are no stamps', () => {
    const open: Match = {
      ...match,
      sets: [played(1, 25, 20), played(2, 12, 8), full(3, true)],
    };
    const results = resultsOf(
      buildLineupSheetHtml({ match: open, team, players, labels, withResults: true }),
    );
    expect(results).toContain('data-status="inProgress"');
    expect(results).toContain('<div class="final">In progress</div>');
    expect(results).toContain('Sets won:</span> 1:0');
    expect(results).toContain(
      '<li data-set-result="1">Set 1 25:20</li><li data-set-result="2">Set 2 12:8 (in progress)</li></ul>',
    );
    expect(results).not.toContain('data-set-result="3"');
    expect(results).not.toContain('Duration');
  });

  it('leaves an unplayed match exactly as before, and a played one without the option too', () => {
    const plain = buildLineupSheetHtml({ match, team, players, labels });
    expect(buildLineupSheetHtml({ match, team, players, labels, withResults: true })).toBe(plain);
    expect(plain).not.toContain('class="results"');
    const playedPlain = buildLineupSheetHtml({ match: won31, team, players, labels });
    expect(playedPlain).not.toContain('class="results"');
    expect(playedPlain).not.toContain('Sets won');
  });

  it('escapes the result labels', () => {
    const out = buildLineupSheetHtml({
      match: won31,
      team,
      players,
      labels: {
        ...labels,
        results: {
          ...labels.results,
          heading: '<script>h()</script>',
          won: '<b>won</b>',
          setScore: (n) => `<i>${n}</i>`,
          durationValue: () => '"<x>"',
        },
      },
      withResults: true,
    });
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<b>');
    expect(out).not.toContain('<i>');
    expect(out).toContain('&lt;script&gt;h()&lt;/script&gt;');
    expect(out).toContain('&lt;i&gt;1&lt;/i&gt;');
    expect(out).toContain('&quot;&lt;x&gt;&quot;');
  });
});

describe('hasResults', () => {
  it('is false until a rally has been played', () => {
    expect(hasResults(match)).toBe(false);
    expect(hasResults({ sets: [] })).toBe(false);
    expect(hasResults({ sets: [played(1, 1, 0)] })).toBe(true);
  });
});

describe('durationParts', () => {
  it('rounds to whole minutes and splits off the hours', () => {
    expect(durationParts(0)).toEqual({ hours: 0, minutes: 0 });
    expect(durationParts(29_999)).toEqual({ hours: 0, minutes: 0 });
    expect(durationParts(30_000)).toEqual({ hours: 0, minutes: 1 });
    expect(durationParts(59 * 60_000)).toEqual({ hours: 0, minutes: 59 });
    expect(durationParts(92 * 60_000 + 10_000)).toEqual({ hours: 1, minutes: 32 });
    expect(durationParts(120 * 60_000)).toEqual({ hours: 2, minutes: 0 });
  });
});

describe('formation roles on empty spots (v6)', () => {
  it('prints the roles of a completely empty set from its formation (6-2, middle order, setter spot 3)', () => {
    const empty: SetLineup = {
      ...emptySetLineup(1),
      formation: { system: '6-2', order: 'middle', setterAt: 3 },
    };
    const out = buildLineupSheetHtml({ match: { ...match, sets: [empty] }, team, players, labels });
    const set = sectionOf(out, 1);
    // S 3 · MB 4 · OH 5 · S 6 · MB 1 · OH 2
    const expected: Record<number, string> = { 1: 'MB', 2: 'OH', 3: 'S', 4: 'MB', 5: 'OH', 6: 'S' };
    for (const pos of [1, 2, 3, 4, 5, 6]) {
      expect(cellOf(set, pos)).toContain(`<span class="role">${expected[pos]}</span>`);
      expect(cellOf(set, pos)).toContain('<span class="empty">—</span>');
    }
    expect(out).not.toContain('class="off-note"');
  });
});
