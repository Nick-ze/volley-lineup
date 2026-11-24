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
import type { ExportFile, Match, Opponent, Player, Season } from './types';

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
    seasonId: 's1',
    opponentId: 'o1',
    opponent: 'Rivals',
    date: '2026-11-01',
    home: true,
    sets: [
      {
        // v6: the formation an older file of this data upgrades to (setter p1 at 1, followed by
        // the middle p2 → 'middle'), so the upgrade tests can compare with the current export.
        formation: { system: '5-1', order: 'middle', setterAt: 1 },
        liberoActive: true,
        setNumber: 1,
        slots: { 1: 'p1', 2: 'p2', 3: null, 4: null, 5: null, 6: null },
        liberoId: 'p3',
        weServeFirst: false,
        liberoReplaces: [],
        events: [],
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
        seasonId: 's2',
        opponentId: 'o2',
        opponent: 'X',
        date: '2026-11-02',
        home: false,
        sets: [emptySetLineup(1)],
      },
    ],
    presets: [
      {
        formation: { system: '5-1', order: 'middle', setterAt: 1 }, // as the set above
        liberoActive: true,
        id: 'ps1',
        teamId: 't1',
        name: '',
        kind: 'starters',
        slots: { 1: 'p1', 2: 'p2', 3: null, 4: null, 5: null, 6: null },
        liberoId: 'p3',
        liberoReplaces: ['p2'],
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        formation: { system: '5-1', order: 'outside', setterAt: 4 }, // setter p1 at 4
        liberoActive: true,
        id: 'ps2',
        teamId: 't1',
        name: 'Strong serve',
        kind: 'preset',
        slots: { 1: null, 2: null, 3: null, 4: 'p1', 5: null, 6: null },
        liberoId: null,
        liberoReplaces: [],
        createdAt: '2026-01-06T00:00:00.000Z',
      },
      {
        formation: { system: '5-1', order: 'outside', setterAt: 1 },
        liberoActive: true,
        id: 'ps3',
        teamId: 't2',
        name: 'Damen A',
        kind: 'preset',
        slots: { 1: 'p4', 2: null, 3: null, 4: null, 5: null, 6: null },
        liberoId: null,
        liberoReplaces: [],
        createdAt: '2026-01-07T00:00:00.000Z',
      },
    ],
    photos: [],
    seasons: [
      {
        id: 's1',
        teamId: 't1',
        name: '2026/27',
        kind: 'season',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 's2',
        teamId: 't2',
        name: 'Cup',
        kind: 'tournament',
        startDate: '2026-11-02',
        location: 'Halle',
        createdAt: '2026-01-02T00:00:00Z',
      },
    ],
    opponents: [
      { id: 'o1', seasonId: 's1', name: 'Rivals', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'o2', seasonId: 's2', name: 'X', createdAt: '2026-01-02T00:00:00Z' },
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
      schemaVersion: 10,
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

  it('exports a single team with its profile, players, matches and presets only', () => {
    const file = buildExport(fixture(), { teamId: 't1', now: NOW });
    expect(file.profiles.map((p) => p.id)).toEqual(['pr1']);
    expect(file.teams.map((t) => t.id)).toEqual(['t1']);
    expect(file.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(file.matches.map((m) => m.id)).toEqual(['m1']);
    expect(file.presets.map((p) => p.id)).toEqual(['ps1', 'ps2']);
    expect(parseImport(serializeExport(file)).ok).toBe(true);
  });

  it('exports nothing for an unknown team', () => {
    expect(summarize(buildExport(fixture(), { teamId: 'nope' }))).toEqual({
      profiles: 0,
      teams: 0,
      players: 0,
      matches: 0,
      presets: 0,
      photos: 0,
      descriptions: 0,
      seasons: 0,
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
    expect(result.summary).toEqual({
      profiles: 2,
      teams: 2,
      players: 4,
      matches: 2,
      presets: 3,
      photos: 0,
      descriptions: 0,
      seasons: 2,
    });
  });

  it('round-trips empty data', () => {
    const empty = {
      profiles: [],
      teams: [],
      players: [],
      matches: [],
      presets: [],
      photos: [],
      seasons: [],
      opponents: [],
    };
    const result = parseImport(exportText(empty));
    expect(result.ok && replaceData(result.file)).toEqual(empty);
  });

  it("sorts each match's sets by set number", () => {
    const data = fixture();
    data.matches[0].sets.reverse();
    const result = parseImport(exportText(data));
    expect(result.ok && result.file.matches[0].sets.map((x) => x.setNumber)).toEqual([1, 2]);
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

  it.each([11, 0, '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', undefined])(
    'schemaVersion %p',
    (version) => {
      expect(parseObject({ ...rawExport(), schemaVersion: version })).toEqual({
        ok: false,
        error: 'UNSUPPORTED_VERSION',
      });
    },
  );

  it('upgrades a v1 file (sets without liberoReplaces/events) to the current version', () => {
    const v1 = rawExport();
    v1.schemaVersion = 1;
    delete v1.presets; // v1 and v2 files have no presets
    for (const m of v1.matches as { sets: Record<string, unknown>[] }[]) {
      for (const set of m.sets) {
        delete set.liberoReplaces;
        delete set.events;
      }
    }
    const result = parseObject(v1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(10);
    expect(result.file).toEqual({ ...JSON.parse(exportText()), presets: [] });
  });

  it('upgrades a v2 file (no presets) to the current version with an empty preset list', () => {
    const v2 = rawExport();
    v2.schemaVersion = 2;
    delete v2.presets;
    const result = parseObject(v2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(10);
    expect(result.file.presets).toEqual([]);
    expect(result.summary.presets).toBe(0);
    expect(result.file.matches).toEqual(fixture().matches);
  });

  it('upgrades a v3 file (untagged points) to the current version without loss', () => {
    const data = fixture();
    data.matches[0].sets[0].slots = { 1: 'p1', 2: 'p2', 3: null, 4: null, 5: null, 6: null };
    data.matches[0].sets[0].events = [
      { type: 'point', winner: 'us' },
      { type: 'sub', outPlayerId: 'p2', inPlayerId: 'p5' },
      { type: 'point', winner: 'them' },
    ];
    data.players.push(player('p5', 't1', 9));
    const v3 = JSON.parse(exportText(data));
    v3.schemaVersion = 3;
    const result = parseObject(v3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file).toEqual({ ...v3, schemaVersion: 10 });
  });

  it('a current file without presets is rejected as INVALID_SHAPE', () => {
    const raw = rawExport();
    delete raw.presets;
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it.each([
    ['an unknown kind', { kind: 'other' }],
    ['a missing slot', { slots: { 1: null, 2: null, 3: null, 4: null, 5: null } }],
    ['a name that is not text', { name: 5 }],
  ])('a preset with a wrong shape: %s', (_label, patch) => {
    const raw = rawExport();
    Object.assign((raw.presets as Record<string, unknown>[])[1], patch);
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it.each([
    ['matches not an array', (raw: Record<string, unknown>) => (raw.matches = {})],
    ['a match that is not an object', (raw: Record<string, unknown>) => (raw.matches = [5])],
    [
      'a match without sets array',
      (raw: Record<string, unknown>) => (raw.matches = [{ id: 'm1', sets: {} }]),
    ],
    [
      'a set that is not an object',
      (raw: Record<string, unknown>) => ((raw.matches as { sets: unknown[] }[])[0].sets = ['nope']),
    ],
  ])('a malformed v1 file is rejected as INVALID_SHAPE: %s', (_label, mutate) => {
    const v1 = rawExport();
    v1.schemaVersion = 1;
    mutate(v1);
    expect(parseObject(v1)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it.each([
    ['liberoReplaces points to another team', { liberoReplaces: ['x1'] }],
    [
      'a substitution brings in a player of another team',
      {
        events: [{ type: 'sub', outPlayerId: 'p1', inPlayerId: 'x1' }],
      },
    ],
  ])('rejects inconsistent v2 lineup data: %s', (_label, patch) => {
    const raw = rawExport();
    raw.players = [
      ...(raw.players as unknown[]),
      {
        id: 'x1',
        teamId: 't2',
        firstName: 'X',
        lastName: 'Y',
        number: 99,
        positions: ['OH'],
        active: true,
      },
    ];
    const m = (raw.matches as { teamId: string; sets: Record<string, unknown>[] }[]).find(
      (x) => x.teamId === 't1',
    )!;
    Object.assign(m.sets[0], patch);
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it('accepts valid v2 lineup data (libero replacement, points and a substitution)', () => {
    const raw = rawExport();
    const m = (raw.matches as { teamId: string; sets: Record<string, unknown>[] }[]).find(
      (x) => x.teamId === 't1',
    )!;
    Object.assign(m.sets[0], {
      liberoReplaces: ['p2'],
      events: [
        { type: 'point', winner: 'us' },
        { type: 'point', winner: 'them' },
        { type: 'sub', outPlayerId: 'p1', inPlayerId: 'p2' },
      ],
    });
    expect(parseObject(raw).ok).toBe(true);
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

  shapeCases.push([
    'player without positions',
    (raw) => ((raw.players as Record<string, unknown>[])[0].positions = []),
  ]);

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
    ['same player in two slots', (d) => (d.matches[0].sets[0].slots[3] = 'p1')],
    ['libero also in a starting slot', (d) => (d.matches[0].sets[0].liberoId = 'p2')],
    ['preset of an unknown team', (d) => (d.presets[1].teamId = 'ghost')],
    ['duplicate preset id', (d) => (d.presets[2].id = d.presets[1].id)],
    ['preset with a player of another team', (d) => (d.presets[1].slots[2] = 'p4')],
    ['preset with an unknown libero', (d) => (d.presets[1].liberoId = 'ghost')],
    ['preset with a player twice', (d) => (d.presets[1].slots[5] = 'p1')],
    ['preset libero also on court', (d) => (d.presets[0].liberoId = 'p1')],
    [
      'preset libero replaces a player of another team',
      (d) => (d.presets[1].liberoReplaces = ['p4']),
    ],
    ['two starters for one team', (d) => (d.presets[1].kind = 'starters')],
    ['blank preset name', (d) => (d.presets[1].name = '   ')],
    ['preset name over 40 characters', (d) => (d.presets[1].name = 'x'.repeat(41))],
    [
      'two presets of a team with the same name (ignoring case)',
      (d) => d.presets.push({ ...d.presets[1], id: 'ps9', name: 'STRONG SERVE' }),
    ],
  ];

  it.each(consistencyCases)('inconsistent references: %s', (_label, breakIt) => {
    const data = fixture();
    breakIt(data);
    expect(isConsistent(data)).toBe(false);
    expect(parseImport(exportText(data))).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it('accepts the same preset name in different teams and an empty starters name', () => {
    const data = fixture();
    data.presets[2].name = 'Strong serve'; // t2 — same name as t1's preset
    expect(data.presets[0].name).toBe(''); // starters
    expect(isConsistent(data)).toBe(true);
  });

  it('refuses a merge that adds a second preset with an existing name', () => {
    const incoming = buildExport(fixture(), { teamId: 't1' });
    incoming.presets = [{ ...incoming.presets[1], id: 'ps-new', name: 'strong serve' }];
    expect(mergeData(fixture(), incoming)).toEqual({ ok: false, error: 'MERGE_CONFLICT' });
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
      presets: [{ ...existing.presets[1], name: 'Renamed preset' }],
      photos: [],
      seasons: [existing.seasons[0] as Season],
      opponents: [existing.opponents[0] as Opponent],
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
    expect(data.presets.map((p) => [p.id, p.name])).toEqual([
      ['ps1', ''],
      ['ps2', 'Renamed preset'],
      ['ps3', 'Damen A'],
    ]);
    expect(isConsistent(data)).toBe(true);
  });

  it('merging a file into empty data equals replacing', () => {
    const empty = {
      profiles: [],
      teams: [],
      players: [],
      matches: [],
      presets: [],
      photos: [],
      seasons: [],
      opponents: [],
    };
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

  it("replaces a team's starters with incoming starters that have another id", () => {
    const incoming = buildExport(fixture(), { teamId: 't1' });
    incoming.presets = [{ ...incoming.presets[0], id: 'ps-new', liberoReplaces: [] }];
    const result = mergeData(fixture(), incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.presets.map((p) => p.id)).toEqual(['ps2', 'ps3', 'ps-new']);
    expect(result.data.presets.filter((p) => p.kind === 'starters')).toHaveLength(1);
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
    expect(Object.keys(result)).toEqual([
      'profiles',
      'teams',
      'players',
      'matches',
      'presets',
      'photos',
      'seasons',
      'opponents',
    ]);
  });

  function file() {
    return buildExport(fixture());
  }
});

describe('v4 point tags and timestamps', () => {
  function tagged(): TransferData {
    const data = fixture();
    data.matches[0].sets[0].events = [
      { type: 'point', winner: 'us', kind: 'kill', playerId: 'p1', at: '2026-11-01T18:00:00.000Z' },
      { type: 'point', winner: 'us', kind: 'opponentError', at: '2026-11-01T18:00:30.000Z' },
      { type: 'point', winner: 'them', kind: 'ourError', playerId: 'p2' },
      { type: 'point', winner: 'them', kind: 'opponentAce' },
      { type: 'point', winner: 'us' },
    ];
    return data;
  }

  it('round-trips tagged and timestamped points exactly', () => {
    const data = tagged();
    const result = parseImport(exportText(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(replaceData(result.file)).toEqual(data);
  });

  it.each([
    ['an unknown kind', { type: 'point', winner: 'us', kind: 'smash' }],
    ['a timestamp that is not text', { type: 'point', winner: 'us', at: 5 }],
    ['an empty player id', { type: 'point', winner: 'us', kind: 'kill', playerId: '' }],
  ])('rejects a point with %s as INVALID_SHAPE', (_label, event) => {
    const raw = rawExport();
    (raw.matches as { sets: { events: unknown[] }[] }[])[0].sets[0].events = [event];
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it.each([
    ['a kind of the other side', { type: 'point', winner: 'us', kind: 'ourError' }],
    [
      'a player on a kind without one',
      { type: 'point', winner: 'them', kind: 'opponentKill', playerId: 'p1' },
    ],
    ['a player without a kind', { type: 'point', winner: 'us', playerId: 'p1' }],
    ['a player of another team', { type: 'point', winner: 'us', kind: 'ace', playerId: 'p4' }],
    ['an unknown player', { type: 'point', winner: 'us', kind: 'block', playerId: 'nobody' }],
  ])('rejects %s as INCONSISTENT_REFERENCES', (_label, event) => {
    const raw = rawExport();
    (raw.matches as { sets: { events: unknown[] }[] }[])[0].sets[0].events = [event];
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });
});

describe('v5 libero switch and v6 formations', () => {
  /** The current export turned into an older file: per-lineup `roles: {}` instead of formations. */
  const asV5 = (): Record<string, unknown> => {
    const v5 = rawExport();
    v5.schemaVersion = 5;
    for (const m of v5.matches as { sets: Record<string, unknown>[] }[]) {
      for (const set of m.sets) {
        delete set.formation;
        set.roles = {};
      }
    }
    for (const preset of v5.presets as Record<string, unknown>[]) {
      delete preset.formation;
      preset.roles = {};
    }
    return v5;
  };

  it('upgrades a v4 file: sets and presets play their primary positions, libero on', () => {
    const v4 = asV5();
    v4.schemaVersion = 4;
    for (const m of v4.matches as { sets: Record<string, unknown>[] }[]) {
      for (const set of m.sets) {
        delete set.roles;
        delete set.liberoActive;
      }
    }
    for (const preset of v4.presets as Record<string, unknown>[]) {
      delete preset.roles;
      delete preset.liberoActive;
    }
    const result = parseObject(v4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file).toEqual(JSON.parse(exportText()));
  });

  it.each([
    ['matches not an array', (raw: Record<string, unknown>) => (raw.matches = {})],
    ['a match without sets', (raw: Record<string, unknown>) => (raw.matches = [{ id: 'm' }])],
    ['presets not an array', (raw: Record<string, unknown>) => (raw.presets = 'x')],
  ])('a malformed v4 file is rejected as INVALID_SHAPE: %s', (_label, mutate) => {
    const v4 = rawExport();
    v4.schemaVersion = 4;
    mutate(v4);
    expect(parseObject(v4)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it('upgrades a v5 file without role overrides: formations from the primary positions', () => {
    const result = parseObject(asV5());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file).toEqual(JSON.parse(exportText()));
  });

  it('upgrades a v5 file with role overrides: the setter at 3 becomes setterAt 3', () => {
    const data = fixture();
    data.players.push(player('p5', 't1', 9)); // an OH
    const v5 = asV5();
    v5.players = JSON.parse(exportText(data)).players;
    const set = (v5.matches as { sets: Record<string, unknown>[] }[])[0].sets[0];
    // p1 (S, OPP) plays OPP at 1, p5 (OH) plays S at 3; p2 (MB) at 4 follows the setter.
    set.slots = { 1: 'p1', 2: null, 3: 'p5', 4: 'p2', 5: null, 6: null };
    set.roles = { p1: 'OPP', p5: 'S' };
    const preset = (v5.presets as Record<string, unknown>[])[1];
    preset.roles = { p1: 'S', ghost: 'OH' }; // a stale override for nobody on court is dropped
    const result = parseObject(v5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const upgraded = result.file.matches[0].sets[0];
    expect(upgraded.formation).toEqual({ system: '5-1', order: 'middle', setterAt: 3 });
    expect('roles' in upgraded).toBe(false);
    expect(result.file.presets[1].formation).toEqual({
      system: '5-1',
      order: 'outside',
      setterAt: 4,
    });
    expect('roles' in result.file.presets[1]).toBe(false);
    expect(result.file.schemaVersion).toBe(10);
  });

  it.each([
    ['matches not an array', (raw: Record<string, unknown>) => (raw.matches = {})],
    ['a match without sets', (raw: Record<string, unknown>) => (raw.matches = [{ id: 'm' }])],
    ['a match that is not an object', (raw: Record<string, unknown>) => (raw.matches = [5])],
    [
      'a set that is not an object',
      (raw: Record<string, unknown>) => ((raw.matches as { sets: unknown[] }[])[0].sets = [null]),
    ],
    [
      'a set without slots',
      (raw: Record<string, unknown>) => {
        delete (raw.matches as { sets: Record<string, unknown>[] }[])[0].sets[0].slots;
      },
    ],
    ['presets not an array', (raw: Record<string, unknown>) => (raw.presets = 'x')],
    ['a preset that is not an object', (raw: Record<string, unknown>) => (raw.presets = ['x'])],
    ['players not an array', (raw: Record<string, unknown>) => (raw.players = {})],
  ])('a malformed v5 file is rejected as INVALID_SHAPE: %s', (_label, mutate) => {
    const v5 = asV5();
    mutate(v5);
    expect(parseObject(v5)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it('round-trips formations and a switched-off libero', () => {
    const data = fixture();
    data.matches[0].sets[0] = {
      ...data.matches[0].sets[0],
      formation: { system: '6-2', order: 'middle', setterAt: 5 },
      liberoActive: false,
    };
    data.presets[0] = {
      ...data.presets[0],
      formation: { system: '5-1', order: 'outside', setterAt: 2 },
      liberoActive: false,
    };
    const result = parseImport(exportText(data));
    expect(result.ok && replaceData(result.file)).toEqual(data);
  });

  it.each([
    ['an unknown system', { system: '4-2', order: 'outside', setterAt: 1 }],
    ['an unknown order', { system: '5-1', order: 'x', setterAt: 1 }],
    ['setterAt 0', { system: '5-1', order: 'outside', setterAt: 0 }],
    ['setterAt 7', { system: '5-1', order: 'outside', setterAt: 7 }],
    ['setterAt as text', { system: '5-1', order: 'outside', setterAt: '1' }],
    ['a missing setterAt', { system: '5-1', order: 'outside' }],
    ['no formation', undefined],
    ['a formation that is not an object', 'outside'],
  ])('rejects %s as INVALID_SHAPE', (_label, formation) => {
    const raw = rawExport();
    (raw.matches as { sets: Record<string, unknown>[] }[])[0].sets[0].formation = formation;
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
    const preset = rawExport();
    (preset.presets as Record<string, unknown>[])[0].formation = formation;
    expect(parseObject(preset)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it('drops leftover v5 role overrides from a current file; a missing libero switch is INVALID_SHAPE', () => {
    const raw = rawExport();
    (raw.matches as { sets: Record<string, unknown>[] }[])[0].sets[0].roles = { p1: 'OH' };
    const result = parseObject(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('roles' in result.file.matches[0].sets[0]).toBe(false);
    const noSwitch = rawExport();
    delete (noSwitch.presets as Record<string, unknown>[])[0].liberoActive;
    expect(parseObject(noSwitch)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });
});

/** The parts of a parsed v7 file the tests below change. */
interface RawV7 {
  photos: { id: string; dataUri: string }[];
  players: Record<string, unknown>[];
  matches: { sets: { events: Record<string, unknown>[] }[] }[];
}

describe('v7 photos, descriptions and error types', () => {
  const jpeg = (n: number) => `data:image/jpeg;base64,${'A'.repeat(n)}==`;
  /** The fixture with a profile photo, a player photo, a description and typed error tags. */
  function v7(): TransferData {
    const data = fixture();
    data.profiles[0] = { ...data.profiles[0], photoId: 'ph1' };
    data.players[0] = { ...data.players[0], photoId: 'ph2', description: 'Calm under pressure.' };
    data.matches[0].sets[0].events = [
      { type: 'point', winner: 'them', kind: 'ourError', playerId: 'p1', errorType: 'serve' },
      { type: 'point', winner: 'them', kind: 'ourError', errorType: 'netFault' },
      { type: 'point', winner: 'them', kind: 'ourError' },
    ];
    data.photos = [
      { id: 'ph1', dataUri: jpeg(40) },
      { id: 'ph2', dataUri: jpeg(80) },
    ];
    return data;
  }

  it('round trip with descriptions restores everything exactly', () => {
    const data = v7();
    const text = serializeExport(buildExport(data, { now: NOW, includeDescriptions: true }));
    const result = parseImport(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(replaceData(result.file)).toEqual(data);
    expect(result.summary).toMatchObject({ photos: 2, descriptions: 1 });
  });

  it('leaves descriptions out by default, keeps the photos', () => {
    const file = buildExport(v7(), { now: NOW });
    expect(file.players[0]).not.toHaveProperty('description');
    expect(file.players[0].photoId).toBe('ph2');
    expect(file.photos.map((p) => p.id)).toEqual(['ph1', 'ph2']);
    expect(serializeExport(file)).not.toContain('Calm under pressure');
  });

  it('exports only the photos of the exported team and drops orphans', () => {
    const data = v7();
    data.players[3] = { ...data.players[3], photoId: 'ph3' }; // p4 of team t2
    data.photos.push({ id: 'ph3', dataUri: jpeg(8) }, { id: 'orphan', dataUri: jpeg(8) });
    expect(buildExport(data).photos.map((p) => p.id)).toEqual(['ph1', 'ph2', 'ph3']);
    expect(buildExport(data, { teamId: 't1' }).photos.map((p) => p.id)).toEqual(['ph1', 'ph2']);
  });

  it('upgrades a v6 file (no photos field) without loss', () => {
    const raw = JSON.parse(exportText(fixture()));
    delete raw.photos;
    raw.schemaVersion = 6;
    const result = parseObject(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(10);
    expect(replaceData(result.file)).toEqual(fixture());
  });

  it('drops photos nobody refers to on import', () => {
    const raw = JSON.parse(exportText(v7()));
    raw.photos.push({ id: 'orphan', dataUri: jpeg(4) });
    const result = parseObject(raw);
    expect(result.ok && result.file.photos.map((p) => p.id)).toEqual(['ph1', 'ph2']);
  });

  it.each<[string, (raw: RawV7) => void]>([
    ['a missing photo', (raw) => (raw.photos = raw.photos.slice(1))],
    ['a duplicate photo id', (raw) => raw.photos.push({ ...raw.photos[0] })],
  ])('rejects %s as INCONSISTENT_REFERENCES', (_label, mutate) => {
    const raw = JSON.parse(exportText(v7()));
    mutate(raw);
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it.each<[string, (raw: RawV7) => void]>([
    ['a photo that is no image data URI', (raw) => (raw.photos[0].dataUri = 'https://x/y.jpg')],
    ['an oversized photo', (raw) => (raw.photos[0].dataUri = jpeg(300_000))],
    ['a blank description', (raw) => (raw.players[0].description = '   ')],
    ['an untrimmed description', (raw) => (raw.players[0].description = ' x ')],
    ['an unknown error type', (raw) => (raw.matches[0].sets[0].events[0].errorType = 'dig')],
    ['a non-string photo id', (raw) => (raw.players[0].photoId = 5)],
  ])('rejects %s as INVALID_SHAPE', (_label, mutate) => {
    const raw = JSON.parse(
      serializeExport(buildExport(v7(), { now: NOW, includeDescriptions: true })),
    );
    mutate(raw);
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it('rejects an error type on another kind as INCONSISTENT_REFERENCES', () => {
    const raw = JSON.parse(exportText(v7()));
    raw.matches[0].sets[0].events[0] = {
      type: 'point',
      winner: 'them',
      kind: 'opponentKill',
      errorType: 'serve',
    };
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it('merge keeps existing photos and descriptions the file lacks; the file wins otherwise', () => {
    const existing = v7();
    // A file from another device: p1 without photo / description, p2 with a new description,
    // the profile with a new photo.
    const incoming = fixture();
    incoming.players[1] = { ...incoming.players[1], description: 'New note.' };
    incoming.profiles[0] = { ...incoming.profiles[0], photoId: 'ph9' };
    incoming.photos = [{ id: 'ph9', dataUri: jpeg(12) }];
    const result = mergeData(existing, buildExport(incoming, { includeDescriptions: true }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { data } = result;
    expect(data.players[0]).toMatchObject({ photoId: 'ph2', description: 'Calm under pressure.' });
    expect(data.players[1].description).toBe('New note.');
    expect(data.profiles[0].photoId).toBe('ph9');
    // ph1 lost its only reference (the profile now uses ph9) and is dropped.
    expect(data.photos.map((p) => p.id)).toEqual(['ph2', 'ph9']);
  });

  it('leaves out photo ids whose photo is missing, so the file still imports (v6 QA)', () => {
    const data = v7();
    data.photos = data.photos.filter((p) => p.id !== 'ph2'); // ph2's storage write failed
    data.profiles[1] = { ...data.profiles[1], photoId: 'ghost' };
    const file = buildExport(data, { now: NOW });
    expect(file.players[0]).not.toHaveProperty('photoId');
    expect(file.profiles[0].photoId).toBe('ph1');
    expect(file.profiles[1]).not.toHaveProperty('photoId');
    expect(parseImport(serializeExport(file)).ok).toBe(true);
  });

  it('merge of a file without descriptions never deletes them', () => {
    const existing = v7();
    const result = mergeData(existing, buildExport(existing));
    expect(result.ok && result.data).toEqual(existing);
  });
});

describe('v8 seasons and opponents', () => {
  it('round trip with a tournament (dates, place) restores exactly', () => {
    const data = fixture();
    const result = parseImport(exportText(data));
    expect(result.ok && replaceData(result.file)).toEqual(data);
  });

  it('upgrades a v7 file: one season per team, opponents by name, matches assigned', () => {
    const raw = JSON.parse(exportText(fixture()));
    delete raw.seasons;
    delete raw.opponents;
    for (const m of raw.matches) {
      delete m.seasonId;
      delete m.opponentId;
    }
    raw.schemaVersion = 7;
    const result = parseObject(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(10);
    expect(result.file.seasons.map((x) => [x.id, x.teamId, x.name])).toEqual([
      ['season-t1', 't1', '2026/27'],
      ['season-t2', 't2', '2026'],
    ]);
    expect(result.file.opponents.map((o) => [o.id, o.name])).toEqual([
      ['opp-season-t1-rivals', 'Rivals'],
      ['opp-season-t2-x', 'X'],
    ]);
    expect(result.file.matches.map((m) => [m.seasonId, m.opponentId, m.opponent])).toEqual([
      ['season-t1', 'opp-season-t1-rivals', 'Rivals'],
      ['season-t2', 'opp-season-t2-x', 'X'],
    ]);
  });

  it('exports a team with only its seasons and their opponents', () => {
    const file = buildExport(fixture(), { teamId: 't2' });
    expect(file.seasons.map((x) => x.id)).toEqual(['s2']);
    expect(file.opponents.map((o) => o.id)).toEqual(['o2']);
    expect(parseImport(serializeExport(file)).ok).toBe(true);
  });

  it.each<[string, (d: TransferData) => void]>([
    ['a season of an unknown team', (d) => ((d.seasons[0] as Season).teamId = 'nope')],
    ['an opponent of an unknown season', (d) => ((d.opponents[0] as Opponent).seasonId = 'nope')],
    ['a match in an unknown season', (d) => ((d.matches[0] as Match).seasonId = 'nope')],
    ['a match in another team’s season', (d) => ((d.matches[0] as Match).seasonId = 's2')],
    [
      'a match against another season’s opponent',
      (d) => ((d.matches[0] as Match).opponentId = 'o2'),
    ],
    ['a duplicate season id', (d) => d.seasons.push({ ...(d.seasons[0] as Season) })],
  ])('rejects %s as INCONSISTENT_REFERENCES', (_label, breakIt) => {
    const data = fixture();
    breakIt(data);
    expect(isConsistent(data)).toBe(false);
    expect(parseImport(exportText(data))).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it('rejects an unknown season kind and a match without a season as INVALID_SHAPE', () => {
    const raw = rawExport() as {
      seasons: Record<string, unknown>[];
      matches: Record<string, unknown>[];
    };
    (raw.seasons[0] as Record<string, unknown>).kind = 'league';
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
    const raw2 = rawExport() as { matches: Record<string, unknown>[] };
    delete (raw2.matches[0] as Record<string, unknown>).seasonId;
    expect(parseObject(raw2)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it('v7 QA: rejects duplicate season or opponent names; a merge matches them by name', () => {
    const dupSeason = fixture();
    dupSeason.seasons.push({ ...(dupSeason.seasons[0] as Season), id: 's9', name: '2026/27 ' });
    expect(isConsistent(dupSeason)).toBe(false);
    const dupOpponent = fixture();
    dupOpponent.opponents.push({
      ...(dupOpponent.opponents[0] as Opponent),
      id: 'o9',
      name: 'RIVALS',
    });
    expect(isConsistent(dupOpponent)).toBe(false);
    // Another device created "2026/27" / "rivals" with other ids.
    const other = fixture();
    other.seasons[0] = { ...(other.seasons[0] as Season), id: 'other-s' };
    other.opponents[0] = {
      ...(other.opponents[0] as Opponent),
      id: 'other-o',
      seasonId: 'other-s',
      name: 'rivals',
    };
    other.matches[0] = {
      ...(other.matches[0] as Match),
      id: 'm7',
      seasonId: 'other-s',
      opponentId: 'other-o',
      opponent: 'rivals',
    };
    const merged = mergeData(fixture(), buildExport(other));
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.data.seasons.map((x) => x.id)).toEqual(['s1', 's2']);
    expect(merged.data.opponents.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(merged.data.matches.find((x) => x.id === 'm7')).toMatchObject({
      seasonId: 's1',
      opponentId: 'o1',
      opponent: 'Rivals',
    });
  });

  it('merging an old (v7) file of the same data on another device adds nothing twice', () => {
    const raw = JSON.parse(exportText(fixture()));
    delete raw.seasons;
    delete raw.opponents;
    for (const m of raw.matches) {
      delete m.seasonId;
      delete m.opponentId;
    }
    raw.schemaVersion = 7;
    const first = parseObject(raw);
    if (!first.ok) throw new Error('import failed');
    const once = replaceData(first.file);
    const twice = mergeData(once, first.file);
    expect(twice.ok && twice.data).toEqual(once);
  });
});

describe('v9 team pictures', () => {
  const jpeg = (n: number) => `data:image/jpeg;base64,${'A'.repeat(n)}==`;
  /** The fixture with a picture on each team and a player picture. */
  function v9(): TransferData {
    const data = fixture();
    data.teams[0] = { ...data.teams[0], photoId: 'tp1' };
    data.teams[1] = { ...data.teams[1], photoId: 'tp2' };
    data.players[0] = { ...data.players[0], photoId: 'pp1' };
    data.photos = [
      { id: 'tp1', dataUri: jpeg(20) },
      { id: 'tp2', dataUri: jpeg(24) },
      { id: 'pp1', dataUri: jpeg(28) },
    ];
    return data;
  }

  it('round trip restores team pictures exactly', () => {
    const data = v9();
    const result = parseImport(exportText(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(10);
    expect(replaceData(result.file)).toEqual(data);
    expect(result.summary.photos).toBe(3);
  });

  it('a team export carries only that team picture', () => {
    const file = buildExport(v9(), { teamId: 't1' });
    expect(file.teams.map((t) => t.photoId)).toEqual(['tp1']);
    expect(file.photos.map((p) => p.id)).toEqual(['tp1', 'pp1']);
  });

  it('leaves out a team photo id whose photo is missing', () => {
    const data = v9();
    data.photos = data.photos.filter((p) => p.id !== 'tp2');
    const file = buildExport(data, { now: NOW });
    expect(file.teams[1]).not.toHaveProperty('photoId');
    expect(parseImport(serializeExport(file)).ok).toBe(true);
  });

  it('upgrades a v8 file (teams without pictures) without loss', () => {
    const raw = JSON.parse(exportText(fixture()));
    raw.schemaVersion = 8;
    const result = parseObject(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(10);
    expect(replaceData(result.file)).toEqual(fixture());
  });

  it('rejects a team picture missing from the file', () => {
    const raw = JSON.parse(exportText(v9()));
    raw.photos = raw.photos.filter((p: { id: string }) => p.id !== 'tp1');
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it('rejects a non-string team photo id', () => {
    const raw = JSON.parse(exportText(v9()));
    raw.teams[0].photoId = 7;
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it('merge keeps a team picture the file lacks; a picture in the file wins', () => {
    const existing = v9();
    const incoming = fixture();
    incoming.teams[1] = { ...incoming.teams[1], photoId: 'tp9' };
    incoming.photos = [{ id: 'tp9', dataUri: jpeg(12) }];
    const result = mergeData(existing, buildExport(incoming));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.teams.map((t) => t.photoId)).toEqual(['tp1', 'tp9']);
    expect(result.data.photos.map((p) => p.id)).toEqual(['tp1', 'pp1', 'tp9']);
  });
});

describe('v10 team captain', () => {
  /** The fixture with p1 as the captain of t1 and p4 of t2. */
  function v10(): TransferData {
    const data = fixture();
    data.teams[0] = { ...data.teams[0], captainId: 'p1' };
    data.teams[1] = { ...data.teams[1], captainId: 'p4' };
    return data;
  }

  it('round trip restores the captains exactly', () => {
    const data = v10();
    const file = buildExport(data, { now: NOW });
    expect(file.teams.map((t) => t.captainId)).toEqual(['p1', 'p4']);
    const result = parseImport(serializeExport(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(10);
    expect(replaceData(result.file)).toEqual(data);
  });

  it('a team export carries that team’s captain', () => {
    expect(buildExport(v10(), { teamId: 't2' }).teams).toEqual([v10().teams[1]]);
  });

  it('imports a v9 file (no captains) without loss and with no captain', () => {
    const raw = JSON.parse(exportText(fixture()));
    raw.schemaVersion = 9;
    const result = parseObject(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(10);
    expect(replaceData(result.file)).toEqual(fixture());
    expect(result.file.teams.every((t) => !('captainId' in t))).toBe(true);
  });

  it.each([
    ['a player of another team', 'p4'],
    ['an unknown player', 'nobody'],
  ])('drops a captain who is %s and keeps everything else', (_label, captainId) => {
    const raw = JSON.parse(exportText(v10()));
    raw.teams[0].captainId = captainId;
    const result = parseObject(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = v10();
    const { captainId: _dropped, ...t1 } = expected.teams[0];
    expect(replaceData(result.file)).toEqual({ ...expected, teams: [t1, expected.teams[1]] });
  });

  it.each([
    ['empty', ''],
    ['a number', 7],
  ])('rejects a captain id that is %s as INVALID_SHAPE', (_label, captainId) => {
    const raw = JSON.parse(exportText(v10()));
    raw.teams[0].captainId = captainId;
    expect(parseObject(raw)).toEqual({ ok: false, error: 'INVALID_SHAPE' });
  });

  it('isConsistent requires the captain to be a player of that team', () => {
    expect(isConsistent(v10())).toBe(true);
    const data = v10();
    data.teams[0] = { ...data.teams[0], captainId: 'p4' };
    expect(isConsistent(data)).toBe(false);
  });

  it('merge: an incoming captain wins', () => {
    const existing = v10();
    const incoming = fixture(); // no captains
    incoming.teams[0] = { ...incoming.teams[0], captainId: 'p2' };
    const result = mergeData(existing, buildExport({ ...incoming, teams: [incoming.teams[0]] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // t1 from the file (new captain p2); t2 is not in the file and keeps p4
    expect(result.data.teams.map((t) => t.captainId)).toEqual(['p2', 'p4']);
  });

  it('merge: a pre-v10 backup (teams without captains) keeps the existing captains', () => {
    const raw = JSON.parse(exportText(fixture()));
    raw.schemaVersion = 9;
    const parsed = parseObject(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = mergeData(v10(), parsed.file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.teams).toEqual(v10().teams);
    // the file's other team fields still win (here: a renamed team)
    const renamed = { ...parsed.file, teams: [{ ...parsed.file.teams[0], name: 'Neu' }] };
    const again = mergeData(v10(), renamed);
    expect(again.ok && again.data.teams[0]).toEqual({ ...v10().teams[0], name: 'Neu' });
  });

  it('merge: an existing captain who is no longer a player of the team is dropped', () => {
    // nothing else of t2 refers to p4, so only the captain is affected
    const existing = { ...v10(), presets: v10().presets.filter((p) => p.id !== 'ps3') };
    // the file has t2 without a captain and moves p4 (t2's captain) into t1
    const incoming: TransferData = {
      ...fixture(),
      profiles: [fixture().profiles[1]],
      teams: [fixture().teams[1]],
      players: [player('p4', 't1', 44)],
      matches: [],
      presets: [],
      seasons: [],
      opponents: [],
    };
    const result = mergeData(existing, incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.teams[0].captainId).toBe('p1');
    expect(result.data.teams[1]).not.toHaveProperty('captainId');
  });

  it('merge clears a captain the file moved to another team, and succeeds', () => {
    // nothing else of t2 refers to p4, so only the captain is affected
    const existing = { ...v10(), presets: v10().presets.filter((p) => p.id !== 'ps3') };
    // the file moves p4 (t2's captain) into t1, without t2
    const incoming: TransferData = {
      ...fixture(),
      teams: [fixture().teams[0]],
      players: [player('p4', 't1', 44)],
      matches: [],
      presets: [],
      seasons: [],
      opponents: [],
    };
    // t2 is not in the file, but its captain p4 is now a player of t1: t2 has no captain
    const result = mergeData(existing, incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.teams[0].captainId).toBe('p1');
    expect(result.data.teams[1]).toEqual(fixture().teams[1]);
    expect(result.data.players.find((p) => p.id === 'p4')?.teamId).toBe('t1');
  });
});
