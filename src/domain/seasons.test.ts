import { emptySetLineup } from './lineup';
import {
  alignIncomingByName,
  cleanName,
  findOpponentByName,
  namesAreUnique,
  foldName,
  opponentHasMatches,
  opponentRecords,
  opponentsForSeason,
  seasonsForTeam,
  upgradeOpponentId,
  upgradeSeasonId,
  upgradeToSeasons,
  validateOpponentName,
  validateSeasonForm,
  type SeasonFormInput,
} from './seasons';
import type { Match, Opponent, PointEvent, Season, SetLineup, SetNumber } from './types';

const season = (id: string, over: Partial<Season> = {}): Season => ({
  id,
  teamId: 't1',
  name: id,
  kind: 'season',
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});
const opponent = (id: string, name: string, seasonId = 's1'): Opponent => ({
  id,
  seasonId,
  name,
  createdAt: '2026-01-01',
});

describe('foldName', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(foldName('  TSV   München ')).toBe('tsv munchen');
  });
});

describe('upgradeToSeasons (store v8 → v9, export v7 → v8)', () => {
  const old = {
    teams: [
      { id: 't1', name: 'Herren', season: ' 2026/27 ', createdAt: '2026-01-01T00:00:00Z' },
      { id: 't2', name: 'Damen', createdAt: '2025-03-01T00:00:00Z' },
      { id: 't3', name: 'Mixed', createdAt: '2024-05-01T00:00:00Z' },
      'junk',
      { name: 'no id' },
    ],
    matches: [
      { id: 'm1', teamId: 't1', opponent: 'TSV München', date: '2026-11-01' },
      { id: 'm2', teamId: 't1', opponent: 'tsv munchen ', date: '2026-11-08' },
      { id: 'm3', teamId: 't1', opponent: 'Rivals', date: '2026-12-01' },
      { id: 'm4', teamId: 't2', opponent: 'Rivals', date: '2025-10-01' },
      { id: 'm5', teamId: 't2', opponent: 'Cup', date: '2026-02-01' },
      { id: 'm6', teamId: 'gone', opponent: 'X' },
      'junk',
    ],
    other: 1,
  };

  it('gives every team one season with all its matches and one opponent per name', () => {
    const up = upgradeToSeasons(old);
    expect(up.other).toBe(1);
    expect(up.seasons).toEqual([
      {
        id: 'season-t1',
        teamId: 't1',
        name: '2026/27',
        kind: 'season',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'season-t2',
        teamId: 't2',
        name: '2025–2026',
        kind: 'season',
        createdAt: '2025-03-01T00:00:00Z',
      },
      {
        id: 'season-t3',
        teamId: 't3',
        name: '2024',
        kind: 'season',
        createdAt: '2024-05-01T00:00:00Z',
      },
    ]);
    expect(up.opponents).toEqual([
      {
        id: 'opp-season-t1-tsv%20munchen',
        seasonId: 'season-t1',
        name: 'TSV München',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'opp-season-t1-rivals',
        seasonId: 'season-t1',
        name: 'Rivals',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'opp-season-t2-rivals',
        seasonId: 'season-t2',
        name: 'Rivals',
        createdAt: '2025-03-01T00:00:00Z',
      },
      {
        id: 'opp-season-t2-cup',
        seasonId: 'season-t2',
        name: 'Cup',
        createdAt: '2025-03-01T00:00:00Z',
      },
    ]);
    const matches = up.matches as Record<string, unknown>[];
    expect(matches.slice(0, 5).map((m) => [m.seasonId, m.opponentId, m.opponent])).toEqual([
      ['season-t1', 'opp-season-t1-tsv%20munchen', 'TSV München'],
      ['season-t1', 'opp-season-t1-tsv%20munchen', 'TSV München'], // v7 QA: one spelling
      ['season-t1', 'opp-season-t1-rivals', 'Rivals'],
      ['season-t2', 'opp-season-t2-rivals', 'Rivals'],
      ['season-t2', 'opp-season-t2-cup', 'Cup'],
    ]);
    expect(matches[5]).toEqual(old.matches[5]); // team gone: left for the schema to judge
    expect(matches[6]).toBe('junk');
  });

  it('is deterministic and leaves data that already has seasons alone', () => {
    expect(upgradeToSeasons(old)).toEqual(upgradeToSeasons(old));
    const current = { seasons: [], teams: [], matches: [] };
    expect(upgradeToSeasons(current)).toBe(current);
    expect(upgradeSeasonId('t9')).toBe('season-t9');
    expect(upgradeOpponentId('s', ' A  b ')).toBe('opp-s-a%20b');
  });

  it('copes with missing or malformed collections and fields', () => {
    expect(upgradeToSeasons({})).toEqual({ seasons: [], opponents: [] });
    expect(upgradeToSeasons({ teams: 'x', matches: 'x' })).toEqual({
      teams: 'x',
      matches: 'x',
      seasons: [],
      opponents: [],
    });
    const odd = upgradeToSeasons({
      teams: [{ id: 't1' }],
      matches: [{ teamId: 't1', date: 'soon' }, { teamId: 't1' }, { teamId: 5 }],
    });
    expect(odd.seasons).toEqual([
      { id: 'season-t1', teamId: 't1', name: '—', kind: 'season', createdAt: '' },
    ]);
    expect(odd.opponents).toEqual([
      { id: 'opp-season-t1-', seasonId: 'season-t1', name: '?', createdAt: '' },
    ]);
    // Matches all in one year: that year.
    const oneYear = upgradeToSeasons({
      teams: [{ id: 't1' }],
      matches: [
        { teamId: 't1', date: '2026-01-01' },
        { teamId: 't1', date: '2026-12-01' },
      ],
    });
    expect((oneYear.seasons as Season[])[0]?.name).toBe('2026');
    // A long season text is cut to 40 characters.
    const long = upgradeToSeasons({ teams: [{ id: 't1', season: 'x'.repeat(50) }], matches: [] });
    expect((long.seasons as Season[])[0]?.name).toHaveLength(40);
  });
});

describe('validateSeasonForm', () => {
  const seasons = [
    season('s1', { name: 'Saison 2026/27' }),
    season('s2', { teamId: 't2', name: 'Cup' }),
  ];
  const input = (over: Partial<SeasonFormInput> = {}): SeasonFormInput => ({
    name: ' Beach Cup ',
    kind: 'tournament',
    startDate: '',
    endDate: '',
    location: '',
    ...over,
  });

  it('accepts a name and leaves blank optional fields out', () => {
    expect(validateSeasonForm(input(), seasons, 't1')).toEqual({
      ok: true,
      value: { name: 'Beach Cup', kind: 'tournament' },
    });
    expect(
      validateSeasonForm(
        input({ startDate: '2026-06-01', endDate: '2026-06-02', location: ' Halle ' }),
        seasons,
        't1',
      ),
    ).toEqual({
      ok: true,
      value: {
        name: 'Beach Cup',
        kind: 'tournament',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        location: 'Halle',
      },
    });
  });

  it('rejects a missing, too long or duplicate name (another team may use it)', () => {
    const errors = (over: Partial<SeasonFormInput>, editing: string | null = null) => {
      const r = validateSeasonForm(input(over), seasons, 't1', editing);
      return r.ok ? null : r.errors;
    };
    expect(errors({ name: '  ' })).toEqual({ name: 'REQUIRED' });
    expect(errors({ name: 'x'.repeat(41) })).toEqual({ name: 'TOO_LONG' });
    expect(errors({ name: 'SAISON 2026/27' })).toEqual({ name: 'DUPLICATE' });
    expect(errors({ name: 'Saison 2026/27' }, 's1')).toBeNull(); // editing itself
    expect(errors({ name: 'Cup' })).toBeNull();
  });

  it('stores Swiss dates (dd.mm.yy, dd.mm.yyyy) as ISO (v8)', () => {
    const r = validateSeasonForm(input({ startDate: ' 1.9.26 ', endDate: '30.06.2027' }), [], 't1');
    expect(r).toMatchObject({
      ok: true,
      value: { startDate: '2026-09-01', endDate: '2027-06-30' },
    });
  });

  it('checks dates and the place', () => {
    const errors = (over: Partial<SeasonFormInput>) => {
      const r = validateSeasonForm(input(over), seasons, 't1');
      return r.ok ? null : r.errors;
    };
    // v8: '1.1.2026' is a valid Swiss date now; '1/1/2026' is still no date.
    expect(errors({ startDate: '2026-02-30', endDate: '1/1/2026' })).toEqual({
      startDate: 'INVALID_DATE',
      endDate: 'INVALID_DATE',
    });
    expect(errors({ startDate: '2026-06-02', endDate: '2026-06-01' })).toEqual({
      endDate: 'END_BEFORE_START',
    });
    expect(errors({ startDate: 'x', endDate: '2026-06-01' })).toEqual({
      startDate: 'INVALID_DATE',
    });
    expect(errors({ endDate: '2026-06-01' })).toBeNull();
    expect(errors({ startDate: '02.06.26', endDate: '1.6.2026' })).toEqual({
      endDate: 'END_BEFORE_START',
    });
    expect(errors({ startDate: 'x', endDate: '31.02.26' })).toEqual({
      startDate: 'INVALID_DATE',
      endDate: 'INVALID_DATE',
    });
    expect(errors({ location: 'x'.repeat(81) })).toEqual({ location: 'TOO_LONG' });
  });
});

describe('opponents', () => {
  const list = [
    opponent('o1', 'Rivals'),
    opponent('o2', 'TSV München'),
    opponent('o3', 'Rivals', 's2'),
  ];

  it('validates names within the season', () => {
    expect(validateOpponentName(' Neu ', list, 's1')).toEqual({ ok: true, name: 'Neu' });
    expect(validateOpponentName('', list, 's1')).toEqual({ ok: false, error: 'REQUIRED' });
    expect(validateOpponentName('x'.repeat(61), list, 's1')).toEqual({
      ok: false,
      error: 'TOO_LONG',
    });
    expect(validateOpponentName('tsv munchen', list, 's1')).toEqual({
      ok: false,
      error: 'DUPLICATE',
    });
    expect(validateOpponentName('TSV München', list, 's1', 'o2')).toEqual({
      ok: true,
      name: 'TSV München',
    });
    expect(validateOpponentName('TSV München', list, 's2')).toEqual({
      ok: true,
      name: 'TSV München',
    });
  });

  it('finds by name, lists by name, knows who has matches', () => {
    expect(findOpponentByName(list, 's1', ' rivals ')?.id).toBe('o1');
    expect(findOpponentByName(list, 's1', 'Nobody')).toBeUndefined();
    expect(opponentsForSeason(list, 's1').map((o) => o.id)).toEqual(['o1', 'o2']);
    const m = { opponentId: 'o1' } as Match;
    expect(opponentHasMatches([m], 'o1')).toBe(true);
    expect(opponentHasMatches([m], 'o2')).toBe(false);
  });
});

describe('seasonsForTeam', () => {
  it('lists the team’s seasons newest first (start date, else creation), then by name', () => {
    const list = [
      season('a', { name: 'B', createdAt: '2025-01-01T00:00:00Z' }),
      season('b', { name: 'Cup', startDate: '2026-06-01' }),
      season('c', { name: 'A', createdAt: '2025-01-01T09:00:00Z' }),
      season('d', { teamId: 't2' }),
    ];
    expect(seasonsForTeam(list, 't1').map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('opponentRecords', () => {
  const W: PointEvent = { type: 'point', winner: 'us' };
  const L: PointEvent = { type: 'point', winner: 'them' };
  const set = (n: SetNumber, events: PointEvent[]): SetLineup => ({ ...emptySetLineup(n), events });
  const won = (n: SetNumber) => set(n, Array(25).fill(W));
  const lost = (n: SetNumber) => set(n, Array(25).fill(L));
  const match = (id: string, opponentId: string, sets: SetLineup[]): Match => ({
    id,
    teamId: 't1',
    seasonId: 's1',
    opponentId,
    opponent: '',
    date: '2026-11-01',
    home: true,
    sets,
  });
  const opponents = [
    opponent('o1', 'Rivals'),
    opponent('o2', 'Alpha'),
    opponent('o3', 'Zeta'),
    opponent('x', 'Other', 's2'),
  ];
  const matches = [
    match('m1', 'o1', [won(1), won(2), won(3)]), // 3:0 won
    match('m2', 'o1', [won(1), lost(2), lost(3), lost(4)]), // 1:3 lost
    match('m3', 'o1', [set(1, [W, L])]), // in progress
    match('m4', 'o1', [emptySetLineup(1)]), // upcoming
    match('m5', 'o2', [won(1), won(2), lost(3), won(4)]), // 3:1 won
  ];

  it('counts played, won, lost, in progress, upcoming and sets per opponent, by name', () => {
    expect(opponentRecords(opponents, matches, 's1')).toEqual([
      {
        opponent: opponents[1],
        played: 1,
        won: 1,
        lost: 0,
        inProgress: 0,
        upcoming: 0,
        setsWon: 3,
        setsLost: 1,
      },
      {
        opponent: opponents[0],
        played: 3,
        won: 1,
        lost: 1,
        inProgress: 1,
        upcoming: 1,
        setsWon: 4,
        setsLost: 3,
      },
      {
        opponent: opponents[2],
        played: 0,
        won: 0,
        lost: 0,
        inProgress: 0,
        upcoming: 0,
        setsWon: 0,
        setsLost: 0,
      },
    ]);
  });
});

describe('v7 QA: clean names, merge by name, unique names', () => {
  it('cleans names: trimmed, single spaces, clamped, "?" when empty', () => {
    expect(cleanName('  TSV   München ')).toBe('TSV München');
    expect(cleanName('   ')).toBe('?');
    expect(cleanName('x'.repeat(70))).toHaveLength(60);
    expect(cleanName('abc  def', 4)).toBe('abc');
  });

  const existing = {
    seasons: [season('s1', { name: '2026/27' })],
    opponents: [opponent('o1', 'Rivals')],
  };
  const m = (id: string, seasonId: string, opponentId: string, name: string): Match => ({
    id,
    teamId: 't1',
    seasonId,
    opponentId,
    opponent: name,
    date: '2026-11-01',
    home: true,
    sets: [],
  });

  it('maps same-named incoming seasons and opponents onto the existing ones', () => {
    const incoming = {
      seasons: [season('x1', { name: '2026/27 ' }), season('x2', { name: 'Cup' })],
      opponents: [
        opponent('y1', 'RIVALS', 'x1'),
        opponent('y2', 'Neu', 'x1'),
        opponent('y3', 'Rivals', 'x2'),
      ],
      matches: [
        m('m1', 'x1', 'y1', 'RIVALS'),
        m('m2', 'x1', 'y2', 'Neu'),
        m('m3', 'x2', 'y3', 'Rivals'),
      ],
    };
    const aligned = alignIncomingByName(existing, incoming);
    expect(aligned.seasons.map((x) => x.id)).toEqual(['x2']);
    expect(aligned.opponents.map((o) => [o.id, o.seasonId])).toEqual([
      ['y2', 's1'],
      ['y3', 'x2'],
    ]);
    expect(aligned.matches.map((x) => [x.seasonId, x.opponentId, x.opponent])).toEqual([
      ['s1', 'o1', 'Rivals'],
      ['s1', 'y2', 'Neu'],
      ['x2', 'y3', 'Rivals'],
    ]);
  });

  it('leaves equal ids to the merge by id', () => {
    const incoming = {
      seasons: existing.seasons,
      opponents: existing.opponents,
      matches: [m('m1', 's1', 'o1', 'Rivals')],
    };
    expect(alignIncomingByName(existing, incoming)).toEqual(incoming);
  });

  it('knows when names are unique', () => {
    expect(namesAreUnique(existing)).toBe(true);
    expect(
      namesAreUnique({
        ...existing,
        seasons: [...existing.seasons, season('s9', { name: '2026/27' })],
      }),
    ).toBe(false);
    expect(
      namesAreUnique({ ...existing, opponents: [...existing.opponents, opponent('o9', 'rivals')] }),
    ).toBe(false);
    expect(
      namesAreUnique({
        ...existing,
        opponents: [...existing.opponents, opponent('o9', 'rivals', 's2')],
      }),
    ).toBe(true);
  });
});
