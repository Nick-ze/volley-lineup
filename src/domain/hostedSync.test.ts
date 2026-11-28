import { isHostedConsistent, type HostedData } from './hostedData';
import {
  applyHostedPush,
  emptyLink,
  hostedKey,
  hostedPushItems,
  keepLinkedTournaments,
  mayWrite,
  mergeHostedRows,
  newHostLink,
  noteHostedEdits,
  parseHostedKey,
  parseHostedRow,
  pendingHostedCount,
  recordsToSlice,
  repairSlice,
  replaceTournamentSlice,
  sliceRecords,
  tournamentLinks,
  tournamentSlice,
  withoutGoneTournamentLinks,
  withTournamentLink,
  type HostedRemoteRecord,
  type TournamentSlice,
} from './hostedSync';
import { pairResultId } from './hostedPlan';
import { payloadHash, type RecordPayload } from './syncRecords';
import { storedSyncData } from './syncSchema';
import type {
  HostedPlayer,
  HostedResult,
  HostedTeam,
  HostedTournament,
  SyncData,
  SyncedTournament,
} from './types';

const T0 = '2026-11-28T10:00:00.000Z';
const T1 = '2026-11-28T10:01:00.000Z';
const T2 = '2026-11-28T10:02:00.000Z';

const cup: HostedTournament = {
  id: 'h1',
  profileId: 'p1',
  name: 'Cup',
  setsPerMatch: 3,
  matchEnd: 'bestOf',
  plan: 'roundRobin',
  createdAt: T0,
};
const team = (id: string, order: number, tournamentId = 'h1'): HostedTeam => ({
  id,
  tournamentId,
  name: `Team ${id}`,
  order,
});
const player = (id: string, teamId: string, extra: Partial<HostedPlayer> = { number: 6 }) =>
  ({ id, teamId, ...extra }) as HostedPlayer;
const result = (
  id: string,
  teamAId: string,
  teamBId: string,
  sets: [number, number][] = [],
  extra: Partial<HostedResult> = {},
): HostedResult => ({
  id,
  tournamentId: 'h1',
  teamAId,
  teamBId,
  sets: sets.map(([a, b]) => ({ a, b })),
  ...extra,
});

const WIN: [number, number][] = [
  [25, 20],
  [25, 22],
];

const slice = (extra: Partial<TournamentSlice> = {}): TournamentSlice => ({
  tournament: cup,
  teams: [team('a', 0), team('b', 1), team('c', 2)],
  players: [player('pa', 'a'), player('pb', 'b', { name: 'Kelly' })],
  results: [result('r1', 'a', 'b', WIN)],
  ...extra,
});

const data = (s: TournamentSlice = slice()): HostedData => ({
  hostedTournaments: [s.tournament],
  hostedTeams: s.teams,
  hostedPlayers: s.players,
  hostedResults: s.results,
});

const host = (extra: Partial<SyncedTournament> = {}): SyncedTournament => ({
  ...emptyLink('u1', 'host'),
  ...extra,
});
const scorer = (extra: Partial<SyncedTournament> = {}): SyncedTournament => ({
  ...emptyLink('u2', 'scorer'),
  ...extra,
});

let version = 100;
const row = (
  kind: HostedRemoteRecord['kind'],
  id: string,
  payload: RecordPayload | null,
  extra: Partial<HostedRemoteRecord> = {},
): HostedRemoteRecord => ({
  kind,
  id,
  payload,
  deleted: payload === null,
  at: T1,
  updatedAt: T1,
  version: (version += 1),
  deviceId: 'dev-remote',
  ...extra,
});

/** A link that knows every record of `records` as the server's (nothing to push). */
function synced(records: ReadonlyMap<string, RecordPayload>, link = host()): SyncedTournament {
  const base = Object.fromEntries(
    [...records].map(([key, payload], i) => [key, { v: i + 1, h: payloadHash(payload), at: T0 }]),
  );
  return { ...link, base };
}

describe('keys and roles', () => {
  it('builds and parses record keys', () => {
    expect(hostedKey('result', 'pair-a-b')).toBe('result:pair-a-b');
    expect(parseHostedKey('result:a:b')).toEqual({ kind: 'result', id: 'a:b' });
    expect(parseHostedKey('team:t1')).toEqual({ kind: 'team', id: 't1' });
    expect(parseHostedKey('match:m1')).toBeNull();
    expect(parseHostedKey('team:')).toBeNull();
    expect(parseHostedKey('team')).toBeNull();
    expect(parseHostedKey(':x')).toBeNull();
  });

  it('lets the host write everything and a scorer results only', () => {
    expect(mayWrite('host', 'tournament')).toBe(true);
    expect(mayWrite('host', 'team')).toBe(true);
    expect(mayWrite('scorer', 'result')).toBe(true);
    expect(mayWrite('scorer', 'team')).toBe(false);
    expect(mayWrite('scorer', 'player')).toBe(false);
    expect(mayWrite('scorer', 'tournament')).toBe(false);
  });
});

describe('links in the sync state', () => {
  const sync: SyncData = { deviceId: 'd', account: null, teams: {} };

  it('reads none from a state without the entry', () => {
    expect(tournamentLinks(sync)).toEqual({});
  });

  it('adds, replaces and removes a link without touching the teams', () => {
    const one = withTournamentLink(sync, 'h1', host());
    expect(one).toEqual({ ...sync, tournaments: { h1: host() } });
    expect(withTournamentLink(one, 'h1', one.tournaments?.h1)).toBe(one);
    const two = withTournamentLink(one, 'h2', scorer());
    expect(Object.keys(tournamentLinks(two))).toEqual(['h1', 'h2']);
    expect(withTournamentLink(two, 'h1', undefined).tournaments).toEqual({ h2: scorer() });
    expect(withTournamentLink(sync, 'h1', undefined)).toBe(sync);
  });

  it('drops the links of tournaments that are gone', () => {
    const two = withTournamentLink(withTournamentLink(sync, 'h1', host()), 'h2', scorer());
    expect(withoutGoneTournamentLinks(two, [{ id: 'h1' }, { id: 'h2' }])).toBe(two);
    expect(withoutGoneTournamentLinks(two, [{ id: 'h2' }]).tournaments).toEqual({ h2: scorer() });
    expect(withoutGoneTournamentLinks(two, []).tournaments).toEqual({});
    expect(withoutGoneTournamentLinks(sync, [])).toBe(sync);
  });
});

describe('a tournament’s slice', () => {
  const other: TournamentSlice = {
    tournament: { ...cup, id: 'h2', name: 'Other' },
    teams: [team('x', 0, 'h2')],
    players: [player('px', 'x')],
    results: [{ ...result('rx', 'x', 'x2'), tournamentId: 'h2' }],
  };
  const both: HostedData = {
    hostedTournaments: [cup, other.tournament],
    hostedTeams: [...slice().teams, ...other.teams],
    hostedPlayers: [...slice().players, ...other.players],
    hostedResults: [...slice().results, ...other.results],
  };

  it('takes one tournament with its teams, their players and its results', () => {
    expect(tournamentSlice(both, 'h1')).toEqual(slice());
    expect(tournamentSlice(both, 'h2')).toEqual(other);
    expect(tournamentSlice(both, 'nope')).toBeUndefined();
  });

  it('replaces a tournament in place and leaves the others alone', () => {
    const renamed = slice({ tournament: { ...cup, name: 'Winter Cup' }, players: [], results: [] });
    const next = replaceTournamentSlice(both, 'h1', renamed);
    expect(next.hostedTournaments.map((x) => x.name)).toEqual(['Winter Cup', 'Other']);
    expect(tournamentSlice(next, 'h1')).toEqual(renamed);
    expect(tournamentSlice(next, 'h2')).toEqual(other);
  });

  it('adds a new tournament at the end and removes one with everything of it', () => {
    const added = replaceTournamentSlice(data(), 'h2', other);
    expect(added.hostedTournaments.map((x) => x.id)).toEqual(['h1', 'h2']);
    expect(tournamentSlice(added, 'h2')).toEqual(other);
    const removed = replaceTournamentSlice(both, 'h1', undefined);
    expect(removed).toEqual(data(other));
  });

  it('keeps the device’s copy of shared tournaments in imported data', () => {
    const incoming: HostedData = {
      hostedTournaments: [{ ...cup, name: 'From the file' }, other.tournament],
      hostedTeams: [team('zz', 0), ...other.teams],
      hostedPlayers: other.players,
      hostedResults: other.results,
    };
    const kept = keepLinkedTournaments(data(), incoming, ['h1']);
    expect(tournamentSlice(kept, 'h1')).toEqual(slice());
    expect(tournamentSlice(kept, 'h2')).toEqual(other);
    // A link without a tournament on the device: the file's copy is left out too.
    expect(
      keepLinkedTournaments(data(), incoming, ['h2']).hostedTournaments.map((x) => x.id),
    ).toEqual(['h1']);
    expect(keepLinkedTournaments(data(), incoming, [])).toBe(incoming);
  });
});

describe('records', () => {
  it('turns a tournament into records without ids and places, and back', () => {
    const own = slice({
      tournament: { ...cup, plan: 'manual' },
      results: [
        result('m2', 'a', 'b', [], { addedAt: T1 }),
        result('m1', 'b', 'c', WIN, { addedAt: T0 }),
        result('m0', 'a', 'c', [], { addedAt: T1 }),
        result('old', 'a', 'c'),
      ],
    });
    const records = sliceRecords(own);
    expect([...records.keys()]).toEqual([
      'tournament:h1',
      'team:a',
      'team:b',
      'team:c',
      'player:pa',
      'player:pb',
      'result:m2',
      'result:m1',
      'result:m0',
      'result:old',
    ]);
    expect(records.get('tournament:h1')).toEqual({
      name: 'Cup',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
      plan: 'manual',
      createdAt: T0,
    });
    expect(records.get('team:a')).toEqual({ name: 'Team a', order: 0 });
    expect(records.get('player:pb')).toEqual({ teamId: 'b', name: 'Kelly' });
    expect(records.get('result:m1')).toEqual({
      teamAId: 'b',
      teamBId: 'c',
      sets: [
        { a: 25, b: 20 },
        { a: 25, b: 22 },
      ],
      addedAt: T0,
    });

    // Back: under the profile of this device, own matches in the order added (then by id).
    const back = recordsToSlice(records, 'h1', 'p9') as TournamentSlice;
    expect(back.tournament).toEqual({ ...own.tournament, profileId: 'p9' });
    expect(back.teams).toEqual(own.teams);
    expect(back.players).toEqual(own.players);
    expect(back.results.map((r) => r.id)).toEqual(['old', 'm1', 'm0', 'm2']);
    expect(back.results.find((r) => r.id === 'm1')).toEqual(own.results[1]);
  });

  it('orders teams by their place (then id) whatever order the records come in', () => {
    const records = new Map<string, RecordPayload>([
      ['team:z', { name: 'Z', order: 1 }],
      ['player:p2', { teamId: 'z', number: 2 }],
      ['team:b', { name: 'B', order: 1 }],
      ['junk', { x: 1 }],
      ['player:p1', { teamId: 'a', number: 1 }],
      ['team:a', { name: 'A', order: 0 }],
      ['tournament:h1', sliceRecords(slice()).get('tournament:h1') as RecordPayload],
    ]);
    const back = recordsToSlice(records, 'h1', 'p1') as TournamentSlice;
    expect(back.teams.map((x) => x.id)).toEqual(['a', 'b', 'z']);
    expect(back.players.map((x) => x.id)).toEqual(['p1', 'p2']);
  });

  it('gives nothing while the tournament’s own record is missing', () => {
    const records = sliceRecords(slice());
    records.delete('tournament:h1');
    expect(recordsToSlice(records, 'h1', 'p1')).toBeUndefined();
  });
});

describe('repairSlice', () => {
  const consistent = (s: TournamentSlice) =>
    isHostedConsistent(data(s), new Set([s.tournament.profileId]));

  it('returns consistent data as it is', () => {
    const s = slice();
    expect(repairSlice(s)).toBe(s);
    expect(consistent(s)).toBe(true);
  });

  it('drops players without a team or without number and name', () => {
    const s = slice({
      players: [player('pa', 'a'), player('gone', 'nope'), player('blank', 'b', { name: ' ' })],
    });
    const fixed = repairSlice(s);
    expect(fixed.players.map((p) => p.id)).toEqual(['pa']);
    expect(consistent(fixed)).toBe(true);
  });

  it('drops results whose teams aren’t both there, or are the same team', () => {
    const s = slice({
      results: [
        result('r1', 'a', 'b', WIN),
        result('r2', 'a', 'nope', WIN),
        result('r3', 'nope', 'b', WIN),
        result('r4', 'c', 'c', WIN),
      ],
    });
    const fixed = repairSlice(s);
    expect(fixed.results.map((r) => r.id)).toEqual(['r1']);
    expect(consistent(fixed)).toBe(true);
  });

  it('keeps one result per pair in a round robin: more sets, then the smaller id', () => {
    const s = slice({
      results: [
        result('r2', 'b', 'a', [[25, 20]]),
        result('r1', 'a', 'b', WIN),
        result('r4', 'a', 'c', WIN),
        result('r3', 'c', 'a', WIN),
        result('r9', 'a', 'c', WIN),
      ],
    });
    const fixed = repairSlice(s);
    expect(fixed.results.map((r) => r.id)).toEqual(['r1', 'r3']);
    expect(consistent(fixed)).toBe(true);
  });

  it('keeps several matches of a pair in a tournament with own matches, also without sets', () => {
    const s = slice({
      tournament: { ...cup, plan: 'manual' },
      results: [result('m1', 'a', 'b', WIN), result('m2', 'a', 'b'), result('m3', 'b', 'a', WIN)],
    });
    expect(repairSlice(s)).toBe(s);
    expect(consistent(s)).toBe(true);
  });

  it('cuts sets the format doesn’t allow after the last valid one, with their live details', () => {
    // Saved as a best of 5 on one phone while the host made it a best of 3.
    const five: [number, number][] = [
      [25, 20],
      [20, 25],
      [25, 20],
      [20, 25],
      [15, 10],
    ];
    const s = slice({
      results: [
        result('r1', 'a', 'b', five, { live: [[], [], [], [], [{ team: 'a' }]] }),
        result('r2', 'a', 'c', [
          [25, 20],
          [25, 20],
          [25, 20],
        ]),
      ],
    });
    const fixed = repairSlice(s);
    expect(fixed.results[0]).toEqual(result('r1', 'a', 'b', five.slice(0, 3)));
    expect(fixed.results[1]).toEqual(
      result(
        'r2',
        'a',
        'c',
        WIN.map(() => [25, 20]),
      ),
    );
    expect(consistent(fixed)).toBe(true);
  });

  it('drops a round robin’s result when no valid set is left, and keeps an own match empty', () => {
    const equal: [number, number][] = [[25, 25]];
    const rr = repairSlice(slice({ results: [result('r1', 'a', 'b', equal)] }));
    expect(rr.results).toEqual([]);
    const own = repairSlice(
      slice({
        tournament: { ...cup, plan: 'manual' },
        results: [result('m1', 'a', 'b', equal, { addedAt: T0 })],
      }),
    );
    expect(own.results).toEqual([result('m1', 'a', 'b', [], { addedAt: T0 })]);
  });

  it('drops live details that name a player who is gone, and keeps the set scores', () => {
    const live = [[{ team: 'a' as const, kind: 'ace' as const, playerId: 'gone' }]];
    const s = slice({
      results: [result('r1', 'a', 'b', [], { live }), result('r2', 'a', 'c', [[1, 0]], { live })],
    });
    const fixed = repairSlice(s);
    // r1 was a running first set only: nothing is left of it.
    expect(fixed.results).toEqual([result('r2', 'a', 'c', [[1, 0]])]);
    expect(consistent(fixed)).toBe(true);
  });

  it('keeps live details that fit', () => {
    const s = slice({
      results: [
        result('r1', 'a', 'b', [], {
          live: [[{ team: 'a', kind: 'ace', playerId: 'pa' }, { team: 'b' }]],
        }),
      ],
    });
    expect(repairSlice(s)).toBe(s);
    expect(consistent(s)).toBe(true);
  });
});

describe('parseHostedRow', () => {
  const raw = {
    kind: 'team',
    id: 't1',
    payload: { name: 'One', order: 0 },
    deleted: false,
    at: '2026-11-28T10:00:00+00:00',
    updated_at: '2026-11-28 10:00:01.5+00',
    version: 7,
    device_id: 'dev',
  };

  it('reads a row and normalizes its times', () => {
    expect(parseHostedRow(raw)).toEqual({
      kind: 'team',
      id: 't1',
      payload: { name: 'One', order: 0 },
      deleted: false,
      at: '2026-11-28T10:00:00.000Z',
      updatedAt: '2026-11-28T10:00:01.500Z',
      version: 7,
      deviceId: 'dev',
    });
    expect(parseHostedRow({ ...raw, device_id: null })?.deviceId).toBe('');
  });

  it('reads every kind', () => {
    const tournament = sliceRecords(slice()).get('tournament:h1');
    expect(
      parseHostedRow({ ...raw, kind: 'tournament', id: 'h1', payload: tournament })?.payload,
    ).toEqual(tournament);
    expect(
      parseHostedRow({ ...raw, kind: 'player', payload: { teamId: 'a', number: 6 } }),
    ).not.toBeNull();
    expect(
      parseHostedRow({ ...raw, kind: 'result', payload: { teamAId: 'a', teamBId: 'b', sets: [] } }),
    ).not.toBeNull();
  });

  it('reads a tombstone, with a null payload or none', () => {
    expect(parseHostedRow({ ...raw, deleted: true, payload: null })).toMatchObject({
      deleted: true,
      payload: null,
    });
    const { payload: _payload, ...bare } = raw;
    expect(parseHostedRow({ ...bare, deleted: true })?.payload).toBeNull();
  });

  it('refuses what it can’t use', () => {
    expect(parseHostedRow(null)).toBeNull();
    expect(parseHostedRow({ ...raw, kind: 'match' })).toBeNull();
    expect(parseHostedRow({ ...raw, id: '' })).toBeNull();
    expect(parseHostedRow({ ...raw, version: 0 })).toBeNull();
    expect(parseHostedRow({ ...raw, at: 'yesterday' })).toBeNull();
    expect(parseHostedRow({ ...raw, payload: { name: 'One' } })).toBeNull(); // no order
    expect(parseHostedRow({ ...raw, deleted: true })).toBeNull(); // a tombstone with a payload
    expect(
      parseHostedRow({ ...raw, kind: 'tournament', id: 'h1', deleted: true, payload: null }),
    ).toBeNull();
  });
});

describe('noteHostedEdits', () => {
  const records = sliceRecords(slice());

  it('notes everything of a tournament the host shares now', () => {
    const link = newHostLink('u1', records, T0);
    expect(link).toMatchObject({ userId: 'u1', role: 'host', cursor: 0, base: {} });
    expect(Object.keys(link.edits).sort()).toEqual([...records.keys()].sort());
    expect(link.edits['team:a']).toEqual({
      at: T0,
      h: payloadHash(records.get('team:a') as RecordPayload),
    });
    expect(pendingHostedCount(link)).toBe(records.size);
  });

  it('changes nothing when the device has what the server has', () => {
    const link = synced(records);
    expect(noteHostedEdits(link, records, T1)).toBe(link);
    expect(pendingHostedCount(link)).toBe(0);
  });

  it('notes a changed, a new and a deleted record with the time, and keeps a noted time', () => {
    const link = synced(records);
    const changed = new Map(records);
    changed.set('team:a', { name: 'Renamed', order: 0 });
    changed.set('team:d', { name: 'New', order: 3 });
    changed.delete('result:r1');
    const noted = noteHostedEdits(link, changed, T1);
    expect(noted.edits).toEqual({
      'team:a': { at: T1, h: payloadHash({ name: 'Renamed', order: 0 }) },
      'team:d': { at: T1, h: payloadHash({ name: 'New', order: 3 }) },
      'result:r1': { at: T1, h: '' },
    });
    // The same content later: the times stay. Changed again: a new time.
    expect(noteHostedEdits(noted, changed, T2)).toBe(noted);
    changed.set('team:a', { name: 'Again', order: 0 });
    expect(noteHostedEdits(noted, changed, T2).edits['team:a'].at).toBe(T2);
  });

  it('forgets an edit that no longer differs', () => {
    const link = { ...synced(records), edits: { 'team:a': { at: T1, h: 'old' } } };
    expect(noteHostedEdits(link, records, T2).edits).toEqual({});
  });

  it('knows a record the server deleted and one that never existed', () => {
    const link = synced(records);
    link.base['team:x'] = { v: 9, h: '', at: T0, del: true };
    expect(noteHostedEdits(link, records, T1)).toBe(link); // deleted there, absent here
    const back = new Map(records).set('team:x', { name: 'Back', order: 9 });
    expect(Object.keys(noteHostedEdits(link, back, T1).edits)).toEqual(['team:x']);
  });

  it('notes only results for a scorer', () => {
    const link = synced(records, scorer());
    const changed = new Map(records);
    changed.set('team:a', { name: 'Renamed', order: 0 });
    changed.set('result:r1', { teamAId: 'a', teamBId: 'b', sets: [] });
    changed.set('junk', {});
    expect(Object.keys(noteHostedEdits(link, changed, T1).edits)).toEqual(['result:r1']);
  });
});

describe('mergeHostedRows', () => {
  const records = sliceRecords(slice());
  const payloadA = { name: 'From the cloud', order: 0 };

  it('takes new rows: changed, new and deleted records', () => {
    const link = synced(records);
    const rows = [
      row('team', 'a', payloadA),
      row('team', 'n', { name: 'New', order: 5 }),
      row('result', 'r1', null),
    ];
    const merged = mergeHostedRows(link, records, rows, 'dev-me');
    expect(merged.changed).toBe(true);
    expect(merged.records.get('team:a')).toEqual(payloadA);
    expect(merged.records.get('team:n')).toEqual({ name: 'New', order: 5 });
    expect(merged.records.has('result:r1')).toBe(false);
    expect(merged.link.base['team:a']).toEqual({
      v: rows[0].version,
      h: payloadHash(payloadA),
      at: T1,
    });
    expect(merged.link.base['result:r1']).toEqual({ v: rows[2].version, h: '', at: T1, del: true });
    // The device's own records were not touched.
    expect(records.get('team:a')).toEqual({ name: 'Team a', order: 0 });
  });

  it('skips rows it already knows and reports no change', () => {
    const link = synced(records);
    const known = row('team', 'a', payloadA, { version: 1 });
    const merged = mergeHostedRows(link, records, [known], 'dev-me');
    expect(merged.link).toBe(link);
    expect(merged.changed).toBe(false);
    expect(mergeHostedRows(link, records, [], 'dev-me').link).toBe(link);
  });

  it('adopts a row with the content the device already has', () => {
    const link = {
      ...synced(records),
      edits: { 'team:a': { at: T2, h: payloadHash(records.get('team:a') as RecordPayload) } },
    };
    const merged = mergeHostedRows(
      link,
      records,
      [row('team', 'a', records.get('team:a') as RecordPayload)],
      'dev-me',
    );
    expect(merged.changed).toBe(false);
    expect(merged.link.edits).toEqual({});
    expect(merged.link.base['team:a'].at).toBe(T1);
  });

  it('keeps a later local change and gives way to a later save of the server', () => {
    const local = new Map(records).set('team:a', { name: 'Mine', order: 0 });
    const edit = { at: T2, h: payloadHash({ name: 'Mine', order: 0 }) };
    const link = { ...synced(records), edits: { 'team:a': edit } };

    const mineLater = mergeHostedRows(
      link,
      local,
      [row('team', 'a', payloadA, { at: T1 })],
      'dev-me',
    );
    expect(mineLater.records.get('team:a')).toEqual({ name: 'Mine', order: 0 });
    expect(mineLater.link.edits['team:a']).toEqual(edit);
    expect(mineLater.link.base['team:a'].h).toBe(payloadHash(payloadA)); // what the server has now
    expect(mineLater.changed).toBe(false);

    const theirsLater = mergeHostedRows(
      link,
      local,
      [row('team', 'a', payloadA, { at: '2026-11-28T10:03:00.000Z' })],
      'dev-me',
    );
    expect(theirsLater.records.get('team:a')).toEqual(payloadA);
    expect(theirsLater.link.edits).toEqual({});
    expect(theirsLater.changed).toBe(true);
  });

  it('breaks a tie of the same time by the device id, like the server', () => {
    const local = new Map(records).set('team:a', { name: 'Mine', order: 0 });
    const link = {
      ...synced(records),
      edits: { 'team:a': { at: T1, h: payloadHash({ name: 'Mine', order: 0 }) } },
    };
    const tie = [row('team', 'a', payloadA, { at: T1, deviceId: 'dev-m' })];
    expect(mergeHostedRows(link, local, tie, 'dev-z').records.get('team:a')).toEqual({
      name: 'Mine',
      order: 0,
    });
    expect(mergeHostedRows(link, local, tie, 'dev-a').records.get('team:a')).toEqual(payloadA);
  });

  it('a local deletion wins or loses the same way', () => {
    const local = new Map(records);
    local.delete('result:r1');
    const link = { ...synced(records), edits: { 'result:r1': { at: T2, h: '' } } };
    const newer = { teamAId: 'a', teamBId: 'b', sets: [{ a: 25, b: 1 }] };
    expect(
      mergeHostedRows(link, local, [row('result', 'r1', newer, { at: T1 })], 'd').records.has(
        'result:r1',
      ),
    ).toBe(false);
    const late = mergeHostedRows(
      link,
      local,
      [row('result', 'r1', newer, { at: '2026-11-28T11:00:00.000Z' })],
      'd',
    );
    expect(late.records.get('result:r1')).toEqual(newer);
  });

  it('never lets a scorer’s change to a team win', () => {
    const local = new Map(records).set('team:a', { name: 'Mine', order: 0 });
    const link = {
      ...synced(records, scorer()),
      edits: {
        'team:a': { at: '2099-01-01T00:00:00.000Z', h: payloadHash({ name: 'Mine', order: 0 }) },
      },
    };
    const merged = mergeHostedRows(link, local, [row('team', 'a', payloadA)], 'dev-me');
    expect(merged.records.get('team:a')).toEqual(payloadA);
    expect(merged.link.edits).toEqual({});
  });

  it('applies rows in the order of their versions', () => {
    const link = synced(records);
    const first = row('team', 'a', { name: 'First', order: 0 });
    const second = row('team', 'a', { name: 'Second', order: 0 });
    const merged = mergeHostedRows(link, records, [second, first], 'dev-me');
    expect(merged.records.get('team:a')).toEqual({ name: 'Second', order: 0 });
    expect(merged.link.base['team:a'].v).toBe(second.version);
  });
});

describe('hostedPushItems', () => {
  const records = sliceRecords(slice());

  it('sends the host’s changes, parents first', () => {
    const link = newHostLink('u1', records, T0);
    const items = hostedPushItems(link, records);
    expect(items.map((i) => i.key)).toEqual([
      'tournament:h1',
      'team:a',
      'team:b',
      'team:c',
      'player:pa',
      'player:pb',
      'result:r1',
    ]);
    expect(items[1]).toEqual({
      key: 'team:a',
      kind: 'team',
      id: 'a',
      at: T0,
      hash: payloadHash(records.get('team:a') as RecordPayload),
      payload: records.get('team:a'),
    });
    expect(hostedPushItems(link, records, 2).map((i) => i.key)).toEqual([
      'tournament:h1',
      'team:a',
    ]);
  });

  it('sends a deletion as a record without payload, but never the tournament’s', () => {
    const local = new Map(records);
    local.delete('team:c');
    local.delete('tournament:h1');
    const link = noteHostedEdits(synced(records), local, T1);
    expect(hostedPushItems(link, local)).toEqual([
      { key: 'team:c', kind: 'team', id: 'c', at: T1, hash: '', payload: null },
    ]);
  });

  it('leaves out what the member may not save, what no longer differs and unreadable keys', () => {
    const local = new Map(records).set('team:a', { name: 'Mine', order: 0 });
    const edits = {
      'team:a': { at: T1, h: 'x' },
      'result:r1': { at: T1, h: 'same as the server' },
      junk: { at: T1, h: 'x' },
    };
    expect(hostedPushItems({ ...synced(records, scorer()), edits }, local)).toEqual([]);
    expect(hostedPushItems({ ...synced(records), edits }, local).map((i) => i.key)).toEqual([
      'team:a',
    ]);
  });
});

describe('applyHostedPush', () => {
  const records = sliceRecords(slice());
  const outcome = (key: string, extra: object) => {
    const { kind, id } = parseHostedKey(key) as { kind: HostedRemoteRecord['kind']; id: string };
    return {
      kind,
      id,
      applied: true,
      version: 50,
      at: T1,
      updatedAt: T1,
      deleted: false,
      ...extra,
    };
  };

  it('stores the new base of applied records and forgets their edits', () => {
    const local = new Map(records).set('team:a', { name: 'Mine', order: 0 });
    local.delete('team:c');
    const link = noteHostedEdits(synced(records), local, T1);
    const pushed = hostedPushItems(link, local);
    const done = applyHostedPush(link, pushed, [
      outcome('team:a', { version: 51 }),
      outcome('team:c', { version: 52, deleted: true }),
      outcome('team:zz', { version: 53 }), // not in this push: ignored
    ]);
    expect(done.stale).toEqual([]);
    expect(done.link.edits).toEqual({});
    expect(done.link.base['team:a']).toEqual({
      v: 51,
      h: payloadHash({ name: 'Mine', order: 0 }),
      at: T1,
    });
    expect(done.link.base['team:c']).toEqual({ v: 52, h: '', at: T1, del: true });
  });

  it('keeps the edit of a record that was changed again during the push', () => {
    const local = new Map(records).set('team:a', { name: 'Mine', order: 0 });
    const link = noteHostedEdits(synced(records), local, T1);
    const pushed = hostedPushItems(link, local);
    const again = { ...link, edits: { 'team:a': { at: T2, h: 'newer' } } };
    const done = applyHostedPush(again, pushed, [outcome('team:a', { version: 51 })]);
    expect(done.link.edits).toEqual({ 'team:a': { at: T2, h: 'newer' } });
    expect(done.link.base['team:a'].v).toBe(51);
  });

  it('hands back what the server kept instead, as rows to merge', () => {
    const local = new Map(records).set('team:a', { name: 'Mine', order: 0 });
    const link = noteHostedEdits(synced(records), local, T1);
    const pushed = hostedPushItems(link, local);
    const theirs = { name: 'Theirs', order: 0 };
    const done = applyHostedPush(link, pushed, [
      outcome('team:a', {
        applied: false,
        version: 60,
        at: T2,
        payload: theirs,
        deviceId: 'dev-x',
      }),
      outcome('result:r1', { applied: false, version: 61, at: T2, deleted: true, payload: null }),
      outcome('team:b', { applied: false, version: 62, at: T2 }),
    ]);
    expect(done.stale).toEqual([
      {
        kind: 'team',
        id: 'a',
        payload: theirs,
        deleted: false,
        at: T2,
        updatedAt: T1,
        version: 60,
        deviceId: 'dev-x',
      },
      {
        kind: 'result',
        id: 'r1',
        payload: null,
        deleted: true,
        at: T2,
        updatedAt: T1,
        version: 61,
        deviceId: '',
      },
      {
        kind: 'team',
        id: 'b',
        payload: null,
        deleted: false,
        at: T2,
        updatedAt: T1,
        version: 62,
        deviceId: '',
      },
    ]);
    // Merging them: the server's save was later, so it replaces the local change.
    const merged = mergeHostedRows(done.link, local, done.stale.slice(0, 2), 'dev-me');
    expect(merged.records.get('team:a')).toEqual(theirs);
    expect(merged.records.has('result:r1')).toBe(false);
    expect(merged.link.edits).toEqual({});
  });

  it('moves a change made on top of a known save to just after it', () => {
    const local = new Map(records).set('team:a', { name: 'Mine', order: 0 });
    // The device clock went back: the edit is older than the save it was made on top of.
    const base = { ...synced(records).base, 'team:a': { v: 70, h: 'known', at: T2 } };
    const link = {
      ...host(),
      base,
      edits: { 'team:a': { at: T1, h: payloadHash({ name: 'Mine', order: 0 }) } },
    };
    const pushed = hostedPushItems(link, local);
    const refused = [outcome('team:a', { applied: false, version: 70, at: T2 })];
    const done = applyHostedPush(link, pushed, refused);
    expect(done.stale).toEqual([]);
    expect(done.link.edits['team:a'].at).toBe('2026-11-28T10:02:00.001Z');
    // Already later: the time stays.
    const later = { ...link, edits: { 'team:a': { at: '2026-11-28T10:05:00.000Z', h: 'x' } } };
    expect(applyHostedPush(later, pushed, refused).link.edits['team:a'].at).toBe(
      '2026-11-28T10:05:00.000Z',
    );
    // A time that can't be read is left alone.
    expect(
      applyHostedPush(link, pushed, [outcome('team:a', { applied: false, version: 70, at: 'x' })])
        .link.edits['team:a'].at,
    ).toBe(T1);
  });
});

describe('the stored sync state with shared tournaments', () => {
  const teams = { deviceId: 'd1', account: null, teams: {} };

  it('keeps valid links and a state without any as they are', () => {
    const withLinks = { ...teams, tournaments: { h1: host(), h2: scorer() } };
    expect(storedSyncData(withLinks)).toBe(withLinks);
    expect(storedSyncData(teams)).toBe(teams);
  });

  it('drops malformed links and keeps the rest of the state', () => {
    expect(storedSyncData({ ...teams, tournaments: { h1: { role: 'owner' } } })).toEqual(teams);
    expect(storedSyncData({ ...teams, tournaments: 'x' })).toEqual(teams);
  });
});

describe('ids of a round robin’s results', () => {
  it('are made from the two teams, whichever way round', () => {
    expect(pairResultId('a', 'b')).toBe('pair-a-b');
    expect(pairResultId('b', 'a')).toBe('pair-a-b');
  });
});
