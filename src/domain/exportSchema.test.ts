import {
  buildExport,
  exportFileName,
  isConsistent,
  mergeData,
  parseImport,
  replaceData,
  serializeExport,
  slugify,
  summarize,
  type TransferData,
} from './exportSchema';
import { emptySetLineup } from './lineup';
import type { ExportFile, Match, Player } from './types';

const NOW = new Date(2026, 10, 20, 9, 30); // 20 Nov 2026, local time

function player(id: string, teamId: string, number: number, extra: Partial<Player> = {}): Player {
  return {
    id,
    teamId,
    firstName: `First ${id}`,
    lastName: `Last ${id}`,
    number,
    positions: ['OH'],
    active: true,
    ...extra,
  };
}

function fixture(): TransferData {
  const match: Match = {
    id: 'm1',
    teamId: 't1',
    opponent: 'Rivals',
    date: '2026-11-01',
    home: true,
    sets: [
      {
        setNumber: 1,
        slots: { 1: 'p1', 2: 'p2', 3: null, 4: null, 5: null, 6: null },
        liberoId: 'p3',
        weServeFirst: false,
      },
      emptySetLineup(2),
    ],
  };
  return {
    profiles: [
      { id: 'pr1', name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'pr2', name: 'Other', color: '#3D8BFF', createdAt: '2026-01-02T00:00:00.000Z' },
    ],
    teams: [
      {
        id: 't1',
        profileId: 'pr1',
        name: 'Herren 1',
        season: '2026/27',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      { id: 't2', profileId: 'pr2', name: 'Damen', createdAt: '2026-01-03T00:00:00.000Z' },
    ],
    players: [
      player('p1', 't1', 7, { positions: ['S', 'OPP'] }),
      player('p2', 't1', 3, { positions: ['MB'], active: false }),
      player('p3', 't1', 1, { positions: ['L'] }),
      player('p4', 't2', 7),
    ],
    matches: [
      match,
      {
        id: 'm2',
        teamId: 't2',
        opponent: 'X',
        date: '2026-11-02',
        home: false,
        sets: [emptySetLineup(1)],
      },
    ],
  };
}

const exportText = (data: TransferData = fixture()) =>
  serializeExport(buildExport(data, { now: NOW }));

/** A valid export as a plain object, to be broken by individual tests. */
const rawExport = (): Record<string, unknown> => JSON.parse(exportText());

const parseObject = (value: unknown) => parseImport(JSON.stringify(value));

describe('buildExport', () => {
  it('exports everything with app id, schema version and timestamp', () => {
    const data = fixture();
    const file = buildExport(data, { now: NOW });
    expect(file).toEqual({
      app: 'volley-lineup',
      schemaVersion: 1,
      exportedAt: NOW.toISOString(),
      ...data,
    });
    // a copy, not the store's arrays
    expect(file.players).not.toBe(data.players);
  });

  it('defaults exportedAt to the current time', () => {
    const before = Date.now();
    const file = buildExport(fixture());
    expect(Date.parse(file.exportedAt)).toBeGreaterThanOrEqual(before);
  });

  it('exports a single team with its profile, players and matches only', () => {
    const file = buildExport(fixture(), { teamId: 't1', now: NOW });
    expect(file.profiles.map((p) => p.id)).toEqual(['pr1']);
    expect(file.teams.map((t) => t.id)).toEqual(['t1']);
    expect(file.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(file.matches.map((m) => m.id)).toEqual(['m1']);
    expect(parseImport(serializeExport(file)).ok).toBe(true);
  });

  it('exports nothing for an unknown team', () => {
    expect(summarize(buildExport(fixture(), { teamId: 'nope' }))).toEqual({
      profiles: 0,
      teams: 0,
      players: 0,
      matches: 0,
    });
  });
});

describe('file names', () => {
  it('uses the local date', () => {
    expect(exportFileName(NOW)).toBe('volley-lineup-2026-11-20.json');
    expect(exportFileName(new Date(2027, 0, 5))).toBe('volley-lineup-2027-01-05.json');
  });

  it('adds a slug of the team name', () => {
    expect(exportFileName(NOW, 'Herren 1')).toBe('volley-lineup-herren-1-2026-11-20.json');
  });

  it('slugifies accents, symbols and empty names', () => {
    expect(slugify('  Süd-Löwen / Damen 2!  ')).toBe('sud-lowen-damen-2');
    expect(slugify('***')).toBe('team');
  });
});

describe('round trip', () => {
  it('build → JSON → parse → replace gives back identical data', () => {
    const original = fixture();
    const result = parseImport(JSON.stringify(buildExport(original)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(replaceData(result.file)).toEqual(original);
    expect(result.summary).toEqual({ profiles: 2, teams: 2, players: 4, matches: 2 });
  });

  it('round-trips empty data', () => {
    const empty = { profiles: [], teams: [], players: [], matches: [] };
    const result = parseImport(exportText(empty));
    expect(result.ok && replaceData(result.file)).toEqual(empty);
  });

  it('drops unknown extra keys', () => {
    const raw = rawExport();
    raw.extra = true;
    (raw.players as Record<string, unknown>[])[0].nickname = 'Ace';
    const result = parseObject(raw);
    expect(result.ok && replaceData(result.file)).toEqual(fixture());
  });
});

describe('parseImport rejects', () => {
  it.each(['', 'not json', '{"app":', 'undefined'])('invalid JSON %p', (text) => {
    expect(parseImport(text)).toEqual({ ok: false, error: 'INVALID_JSON' });
  });

  it.each([
    ['an unrelated object', { foo: 1 }],
    ['an array', [1, 2]],
    ['a string', 'volley-lineup'],
    ['null', null],
    ['another app', { ...JSON.parse(exportText()), app: 'other-app' }],
  ])('a foreign file: %s', (_label, value) => {
    expect(parseObject(value)).toEqual({ ok: false, error: 'NOT_VOLLEY_LINEUP' });
  });

  it.each([2, 0, '1', undefined])('schemaVersion %p', (version) => {
    expect(parseObject({ ...rawExport(), schemaVersion: version })).toEqual({
      ok: false,
      error: 'UNSUPPORTED_VERSION',
    });
  });

  const shapeCases: [string, (raw: Record<string, unknown>) => void][] = [
    ['missing players', (raw) => delete raw.players],
    ['missing exportedAt', (raw) => delete raw.exportedAt],
    ['teams not an array', (raw) => (raw.teams = {})],
    [
      'player without a number',
      (raw) => delete (raw.players as Record<string, unknown>[])[0].number,
    ],
    [
      'jersey number as text',
      (raw) => ((raw.players as Record<string, unknown>[])[0].number = '7'),
    ],
    [
      'fractional jersey number',
      (raw) => ((raw.players as Record<string, unknown>[])[0].number = 7.5),
    ],
    [
      'negative jersey number',
      (raw) => ((raw.players as Record<string, unknown>[])[0].number = -1),
    ],
    [
      'unknown position',
      (raw) => ((raw.players as Record<string, unknown>[])[0].positions = ['XX']),
    ],
    ['active as text', (raw) => ((raw.players as Record<string, unknown>[])[0].active = 'yes')],
    ['empty id', (raw) => ((raw.profiles as Record<string, unknown>[])[0].id = '')],
    ['season as number', (raw) => ((raw.teams as Record<string, unknown>[])[0].season = 2026)],
    ['match with no sets', (raw) => ((raw.matches as Record<string, unknown>[])[0].sets = [])],
    [
      'match with 6 sets',
      (raw) =>
        ((raw.matches as Record<string, unknown>[])[0].sets = [1, 2, 3, 4, 5, 5].map((n) =>
          emptySetLineup(n as 1),
        )),
    ],
    [
      'set number 6',
      (raw) =>
        ((raw.matches as Record<string, unknown>[])[0].sets = [
          { ...emptySetLineup(1), setNumber: 6 },
        ]),
    ],
    [
      'missing slot',
      (raw) =>
        ((raw.matches as Record<string, unknown>[])[0].sets = [
          { ...emptySetLineup(1), slots: { 1: null, 2: null, 3: null, 4: null, 5: null } },
        ]),
    ],
    ['home as text', (raw) => ((raw.matches as Record<string, unknown>[])[0].home = 'true')],
  ];

  it.each(shapeCases)('a wrong shape: %s', (_label, breakIt) => {
    const raw = rawExport();
    breakIt(raw);
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  const consistencyCases: [string, (d: TransferData) => void][] = [
    ['team of an unknown profile', (d) => (d.teams[0].profileId = 'ghost')],
    ['player of an unknown team', (d) => (d.players[0].teamId = 'ghost')],
    ['match of an unknown team', (d) => (d.matches[0].teamId = 'ghost')],
    ['duplicate profile id', (d) => (d.profiles[1].id = d.profiles[0].id)],
    ['duplicate team id', (d) => d.teams.push({ ...d.teams[0], name: 'Copy' })],
    ['duplicate player id', (d) => d.players.push({ ...d.players[0], number: 99 })],
    ['duplicate match id', (d) => d.matches.push({ ...d.matches[0] })],
    ['duplicate jersey number in a team', (d) => (d.players[1].number = 7)],
    ['slot with an unknown player', (d) => (d.matches[0].sets[0].slots[3] = 'ghost')],
    ['slot with a player of another team', (d) => (d.matches[0].sets[0].slots[3] = 'p4')],
    ['libero unknown', (d) => (d.matches[0].sets[0].liberoId = 'ghost')],
    ['set number twice in a match', (d) => (d.matches[0].sets[1].setNumber = 1)],
  ];

  it.each(consistencyCases)('inconsistent references: %s', (_label, breakIt) => {
    const data = fixture();
    breakIt(data);
    expect(isConsistent(data)).toBe(false);
    expect(parseImport(exportText(data))).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it('accepts the same jersey number in different teams', () => {
    expect(isConsistent(fixture())).toBe(true); // p1 (t1) and p4 (t2) are both #7
  });
});

describe('mergeData', () => {
  const file = (data: TransferData): ExportFile => buildExport(data, { now: NOW });

  it('keeps existing items, appends new ones and lets incoming win on equal id', () => {
    const existing = fixture();
    const incoming: TransferData = {
      profiles: [{ ...existing.profiles[0], name: 'Renamed coach' }],
      teams: [
        { ...existing.teams[0], name: 'Herren 1 (new)' },
        { id: 't3', profileId: 'pr1', name: 'Mixed', createdAt: '2026-02-01T00:00:00.000Z' },
      ],
      players: [{ ...existing.players[0], firstName: 'Changed' }, player('p9', 't3', 10)],
      matches: [{ ...existing.matches[0], opponent: 'New rivals' }],
    };
    const result = mergeData(existing, file(incoming));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data } = result;
    expect(data.profiles.map((p) => [p.id, p.name])).toEqual([
      ['pr1', 'Renamed coach'],
      ['pr2', 'Other'],
    ]);
    expect(data.teams.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(data.teams[0].name).toBe('Herren 1 (new)');
    expect(data.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p9']);
    expect(data.players[0].firstName).toBe('Changed');
    expect(data.matches.map((m) => m.opponent)).toEqual(['New rivals', 'X']);
    expect(isConsistent(data)).toBe(true);
  });

  it('merging a file into empty data equals replacing', () => {
    const empty = { profiles: [], teams: [], players: [], matches: [] };
    const result = mergeData(empty, file(fixture()));
    expect(result).toEqual({ ok: true, data: fixture() });
  });

  it('merging the same data twice changes nothing', () => {
    expect(mergeData(fixture(), file(fixture()))).toEqual({ ok: true, data: fixture() });
  });

  it('refuses a merge that would create a jersey number clash', () => {
    const incoming = buildExport(fixture(), { teamId: 't1' });
    incoming.players = [player('p-new', 't1', 7)]; // existing p1 is #7 in t1
    expect(mergeData(fixture(), incoming)).toEqual({ ok: false, error: 'MERGE_CONFLICT' });
  });

  it('accepts a renumbering when the incoming player keeps its id', () => {
    const incoming = buildExport(fixture(), { teamId: 't1' });
    incoming.players = [{ ...incoming.players[0], number: 42 }];
    const result = mergeData(fixture(), incoming);
    expect(result.ok && result.data.players[0].number).toBe(42);
  });
});

describe('replaceData', () => {
  it('returns only the incoming data', () => {
    const result = replaceData(file());
    expect(result).toEqual(fixture());
    expect(Object.keys(result)).toEqual(['profiles', 'teams', 'players', 'matches']);
  });

  function file() {
    return buildExport(fixture());
  }
});
