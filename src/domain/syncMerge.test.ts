import {
  goldenTeamData,
  linkedTeam,
  serverBase,
  sliceOf,
  sliceTransfer,
} from '@/test-utils/syncFixtures';

import { isConsistent } from './exportConsistency';
import { detectChanges, type LocalChange } from './syncChanges';
import {
  adoptExisting,
  applyPushResults,
  EPOCH,
  mergeRemote,
  nextCursor,
  resetToCloudMerge,
  type MergeInput,
  type PushOutcome,
} from './syncMerge';
import {
  parseRecordKey,
  payloadHash,
  replaceTeamSlice,
  sliceToRecords,
  type RecordPayload,
  type TeamData,
  type TeamSlice,
} from './syncRecords';
import type { RemoteRecord } from './syncSchema';
import type { Player, SyncedTeam } from './types';

const T0 = '2026-11-26T10:00:00.000Z';
const T1 = '2026-11-26T10:05:00.000Z';
const T2 = '2026-11-26T10:09:00.000Z';
const T3 = '2026-11-26T10:12:00.000Z';

const golden = () => sliceOf(goldenTeamData(), 't1');
const recs = sliceToRecords(golden());
const payload = (key: string) => recs.get(key) as RecordPayload;
const synced = (slice: TeamSlice, overrides: Partial<SyncedTeam> = {}) =>
  linkedTeam({ base: serverBase(slice, T0), ...overrides });

let version = 100;
function row(
  key: string,
  content: RecordPayload | null,
  at = T1,
  extra: Partial<RemoteRecord> = {},
): RemoteRecord {
  const { kind, id } = parseRecordKey(key) as NonNullable<ReturnType<typeof parseRecordKey>>;
  version += 1;
  return {
    kind,
    id,
    payload: content,
    deleted: content === null,
    at,
    updatedAt: at,
    version,
    deviceId: 'dev2',
    ...extra,
  };
}

function merge(input: Partial<MergeInput> & { slice: TeamSlice | undefined; reset?: boolean }) {
  const { reset, ...rest } = input;
  return (reset ? resetToCloudMerge : mergeRemote)({
    teamId: 't1',
    team: input.slice ? synced(input.slice) : linkedTeam(),
    rows: [],
    local: { profileId: 'prX' },
    foreignIds: new Set(),
    ...rest,
  });
}

/** The slice after a local change, with the change noted at `at` (as the engine does). */
function locally(slice: TeamSlice, change: (s: TeamSlice) => TeamSlice, at: string) {
  const next = change(slice);
  const team = synced(slice);
  return { slice: next, team: { ...team, edits: detectChanges(next, team, at).edits } };
}

const withPlayer = (s: TeamSlice, id: string, patch: Partial<Player>): TeamSlice => ({
  ...s,
  players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
});

describe('mergeRemote: applying rows', () => {
  it('downloads a whole team (profile from the account, no descriptions)', () => {
    const slice = golden();
    const rows = [...recs].map(([key, p]) => row(key, p, T0)).reverse();
    const out = merge({ slice: undefined, rows });
    const { description: _description, ...p1 } = slice.players[0];
    expect(out.slice).toEqual({
      ...slice,
      team: { ...slice.team, profileId: 'prX' },
      players: [p1, ...slice.players.slice(1)],
      // Parents first: the starters (a later kind) come after the named preset.
      presets: [slice.presets[1], slice.presets[0]],
    });
    expect(Object.keys(out.team.base)).toHaveLength(recs.size);
    expect(out.team.base['player:p1']).toEqual({
      v: expect.any(Number),
      h: payloadHash(payload('player:p1')),
      at: T0,
    });
    expect(out.skipped).toEqual([]);
    expect(out.issues).toEqual([]);
  });

  it('skips rows it already has and keeps every object when nothing changed', () => {
    const slice = golden();
    const team = synced(slice);
    const old = row('player:p2', { ...payload('player:p2'), firstName: 'Old' }, T1, { version: 3 });
    const out = merge({ slice, team, rows: [old] });
    expect(out.slice).toBe(slice);
    expect(out.team).toBe(team);
    expect(out).toMatchObject({ skipped: [], issues: [] });
  });

  it('keeps the slice object when the server sends the same content again', () => {
    const slice = golden();
    const out = merge({ slice, rows: [row('player:p2', { ...payload('player:p2') })] });
    expect(out.slice).toBe(slice);
    expect(out.team.base['player:p2'].v).toBe(version);
  });

  it('applies a newer row to a record the device has not changed', () => {
    const slice = golden();
    const out = merge({
      slice,
      rows: [row('player:p2', { ...payload('player:p2'), firstName: 'Bea' })],
    });
    const next = out.slice as TeamSlice;
    expect(next.players[1]).toEqual({ ...slice.players[1], firstName: 'Bea' });
    expect(next.players[0]).toBe(slice.players[0]);
    expect(next.matches).toEqual(slice.matches);
    expect(next.matches[0]).toBe(slice.matches[0]);
  });

  it('keeps the local profile, the descriptions and the order', () => {
    const slice = golden();
    const out = merge({
      slice,
      rows: [
        row('team:t1', { ...payload('team:t1'), name: 'Renamed' }),
        row('player:p1', { ...payload('player:p1'), lastName: 'Neu', description: 'leak' }),
      ],
    });
    const next = out.slice as TeamSlice;
    expect(next.team).toEqual({ ...slice.team, name: 'Renamed' });
    expect(next.players[0]).toEqual({ ...slice.players[0], lastName: 'Neu' });
    expect(next.players[0].description).toBe('Strong serve. Knee tape.');
  });

  it('appends new records', () => {
    const slice = golden();
    const out = merge({
      slice,
      rows: [row('player:p20', { ...payload('player:p2'), number: 20 })],
    });
    expect((out.slice as TeamSlice).players.map((p) => p.id).slice(-2)).toEqual(['p8', 'p20']);
  });
});

describe('mergeRemote: rows', () => {
  it('uses the newest row of a key when a pull has it twice', () => {
    const slice = golden();
    const newer = row('player:p2', { ...payload('player:p2'), firstName: 'New' });
    const older = {
      ...row('player:p2', { ...payload('player:p2'), firstName: 'Old' }),
      version: 1,
    };
    const out = merge({ slice, team: linkedTeam(), rows: [newer, older] });
    expect((out.slice as TeamSlice).players[1].firstName).toBe('New');
  });

  it('applies a deleted starters', () => {
    const out = merge({ slice: golden(), rows: [row('starters:t1', null)] });
    expect((out.slice as TeamSlice).presets.map((p) => p.id)).toEqual(['ps2']);
  });

  it('leaves records the device already had without a parent alone', () => {
    const base = golden();
    const lost = { ...base.matches[1], id: 'm7', opponentId: 'gone' };
    const slice = { ...base, matches: [...base.matches, lost] };
    const out = merge({
      slice,
      rows: [row('player:p2', { ...payload('player:p2'), firstName: 'B' })],
    });
    expect((out.slice as TeamSlice).matches[2]).toBe(lost);
  });
});

describe('mergeRemote: conflicts (most recent save wins)', () => {
  const edited = () => locally(golden(), (s) => withPlayer(s, 'p2', { firstName: 'Local' }), T2);
  const remote = (at: string) =>
    row('player:p2', { ...payload('player:p2'), firstName: 'Remote' }, at);

  it('keeps a local change saved after the server copy (pushed next)', () => {
    const { slice, team } = edited();
    const incoming = remote(T1);
    const out = merge({ slice, team, rows: [incoming] });
    expect((out.slice as TeamSlice).players[1].firstName).toBe('Local');
    expect(out.team.edits['player:p2']).toBe(team.edits['player:p2']);
    expect(out.team.base['player:p2']).toMatchObject({ v: incoming.version, at: T1 });
    expect(detectChanges(out.slice, out.team, T3).changes.map((c) => [c.key, c.at])).toEqual([
      ['player:p2', T2],
    ]);
  });

  it('takes a server copy saved later (or at the same millisecond) and forgets the change', () => {
    for (const at of [T3, T2]) {
      const { slice, team } = edited();
      const out = merge({ slice, team, rows: [remote(at)] });
      expect((out.slice as TeamSlice).players[1].firstName).toBe('Remote');
      expect(out.team.edits).toEqual({});
      expect(detectChanges(out.slice, out.team, T3).changes).toEqual([]);
    }
  });

  it('keeps a local deletion saved later, and brings the record back for a later save', () => {
    const drop = (s: TeamSlice) => ({ ...s, presets: s.presets.filter((p) => p.id !== 'ps2') });
    const { slice, team } = locally(golden(), drop, T2);
    const update = (at: string) =>
      row('preset:ps2', { ...payload('preset:ps2'), name: 'Remote' }, at);
    const kept = merge({ slice, team, rows: [update(T1)] });
    expect((kept.slice as TeamSlice).presets.map((p) => p.id)).toEqual(['ps1']);
    expect(detectChanges(kept.slice, kept.team, T3).changes.map((c) => [c.key, c.at])).toEqual([
      ['preset:ps2', T2],
    ]);
    const back = merge({ slice, team, rows: [update(T3)] });
    expect((back.slice as TeamSlice).presets.map((p) => p.name)).toEqual(['', 'Remote']);
  });

  it('lets the server win a change that was never noted (and on viewers)', () => {
    const slice = withPlayer(golden(), 'p2', { firstName: 'Local' });
    const out = merge({ slice, team: synced(golden(), { role: 'player' }), rows: [remote(T1)] });
    expect((out.slice as TeamSlice).players[1].firstName).toBe('Remote');
  });

  it('keeps a local record the server never had when it was saved later', () => {
    const base = golden();
    const { slice, team } = locally(
      base,
      (s) => ({ ...s, players: [...s.players, { ...s.players[1], id: 'p20', number: 20 }] }),
      T2,
    );
    const out = merge({
      slice,
      team,
      rows: [row('player:p20', { ...payload('player:p2'), number: 30 })],
    });
    expect((out.slice as TeamSlice).players[8].number).toBe(20);
  });
});

describe('mergeRemote: invalid and foreign rows', () => {
  it('skips and reports invalid rows (no base)', () => {
    const slice = golden();
    const rows = [
      row('player:p2', { firstName: 'only' }),
      row('team:other', payload('team:t1')),
      row('starters:other', payload('starters:t1')),
      row('team:t1', null),
      { ...row('preset:ps2', null), payload: payload('preset:ps2') },
    ];
    const out = merge({ slice, rows });
    expect(out.skipped).toEqual([
      { key: 'team:other', reason: 'invalid' },
      { key: 'team:t1', reason: 'invalid' },
      { key: 'player:p2', reason: 'invalid' },
      { key: 'preset:ps2', reason: 'invalid' },
      { key: 'starters:other', reason: 'invalid' },
    ]);
    expect(out.slice).toBe(slice);
    expect(out.team.base['player:p2'].v).toBe(serverBase(slice, T0)['player:p2'].v);
  });

  it("skips ids that belong to the device's other teams", () => {
    const slice = golden();
    const starters = payload('starters:t1');
    const rows = [
      row('player:p9', payload('player:p2')),
      row('set:m3/1', payload('set:m2/1')),
      row('starters:t1', { ...starters, presetId: 'foreign' }),
    ];
    const foreignIds = new Set(['player:p9', 'match:m3', 'preset:foreign']);
    const out = merge({ slice, rows, foreignIds });
    expect(out.skipped.map((s) => [s.key, s.reason])).toEqual([
      ['player:p9', 'foreignId'],
      ['set:m3/1', 'foreignId'],
      ['starters:t1', 'foreignId'],
    ]);
    expect(out.team.base).not.toHaveProperty('player:p9');
  });

  it('keeps the ids of named presets and the starters apart', () => {
    const slice = golden();
    const out = merge({
      slice,
      rows: [
        row('starters:t1', { ...payload('starters:t1'), presetId: 'ps2' }),
        row('preset:ps1', payload('preset:ps2')),
      ],
    });
    expect(out.skipped.map((s) => s.reason)).toEqual(['foreignId', 'foreignId']);
  });

  it('takes the starters of the server with its id', () => {
    const slice = golden();
    const out = merge({
      slice,
      rows: [row('starters:t1', { ...payload('starters:t1'), presetId: 'psB' })],
    });
    const next = out.slice as TeamSlice;
    expect(next.presets.map((p) => [p.id, p.kind])).toEqual([
      ['psB', 'starters'],
      ['ps2', 'preset'],
    ]);
  });
});

describe('mergeRemote: deletions', () => {
  it('removes a deleted record the device has not changed', () => {
    const slice = golden();
    const out = merge({ slice, rows: [row('preset:ps2', null)] });
    expect((out.slice as TeamSlice).presets.map((p) => p.id)).toEqual(['ps1']);
    expect(out.team.base['preset:ps2']).toMatchObject({ h: '', del: true });
    expect(detectChanges(out.slice, out.team, T3).changes).toEqual([]);
  });

  it('notes a deletion of a record the device does not have', () => {
    const slice = golden();
    const out = merge({ slice, rows: [row('player:p30', null)] });
    expect(out.team.base['player:p30']).toMatchObject({ del: true });
    expect(out.slice).toBe(slice);
  });

  it('cascades a season: opponents, matches and sets go without tombstones', () => {
    const slice = golden();
    const out = merge({ slice, rows: [row('season:s1', null)] });
    const next = out.slice as TeamSlice;
    expect(next.seasons.map((x) => x.id)).toEqual(['s2']);
    expect(next.opponents.map((o) => o.id)).toEqual(['o3']);
    expect(next.matches.map((m) => m.id)).toEqual(['m2']);
    for (const key of ['opponent:o1', 'opponent:o2', 'match:m1', 'set:m1/1', 'set:m1/3']) {
      expect(out.team.base).not.toHaveProperty(key);
    }
    expect(detectChanges(next, out.team, T3).changes).toEqual([]);
    expect(isConsistent(sliceTransfer(next))).toBe(true);
  });

  it('cascades an opponent to its matches and a match to its sets', () => {
    const slice = golden();
    const byOpponent = merge({ slice, rows: [row('opponent:o3', null)] }).slice as TeamSlice;
    expect(byOpponent.matches.map((m) => m.id)).toEqual(['m1']);
    const byMatch = merge({ slice, rows: [row('match:m1', null)] });
    expect((byMatch.slice as TeamSlice).matches.map((m) => m.id)).toEqual(['m2']);
    expect(byMatch.team.base).not.toHaveProperty('set:m1/2');
  });

  it('handles tombstones of a season and everything below it in one pull', () => {
    const slice = golden();
    const keys = ['season:s2', 'opponent:o3', 'match:m2', 'set:m2/1'];
    const out = merge({ slice, rows: keys.map((k) => row(k, null)) });
    expect((out.slice as TeamSlice).matches.map((m) => m.id)).toEqual(['m1']);
    expect(out.team.base['season:s2']).toMatchObject({ del: true });
  });

  it('brings a season back when a match in it was changed later (pushed again)', () => {
    const { slice, team } = locally(
      golden(),
      (s) => ({ ...s, matches: s.matches.map((m) => (m.id === 'm2' ? { ...m, home: true } : m)) }),
      T2,
    );
    const rows = ['season:s2', 'opponent:o3', 'match:m2', 'set:m2/1'].map((k) => row(k, null, T1));
    const out = merge({ slice, team, rows });
    const next = out.slice as TeamSlice;
    expect(next.seasons.map((x) => x.id)).toEqual(['s1', 's2']);
    expect(next.opponents.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(next.matches[1].sets).toHaveLength(1);
    const pushed = detectChanges(next, out.team, T3).changes.map((c) => c.key);
    expect(pushed).toEqual(['season:s2', 'opponent:o3', 'match:m2', 'set:m2/1']);
  });

  it('brings a season back for a newer match another device added (pulled together)', () => {
    const slice = golden();
    const m9 = { ...payload('match:m2'), date: '2027-01-01' };
    const rows = [
      row('season:s2', null, T1),
      row('opponent:o3', null, T1),
      row('match:m9', m9, T2),
      row('set:m9/1', payload('set:m2/1'), T2),
      row('match:m2', null, T1),
    ];
    const next = merge({ slice, rows }).slice as TeamSlice;
    expect(next.seasons.map((x) => x.id)).toEqual(['s1', 's2']);
    expect(next.matches.map((m) => m.id)).toEqual(['m1', 'm9']);
  });

  it('lets an older match go with its deleted season', () => {
    const slice = golden();
    const rows = [row('season:s2', null, T2), row('match:m2', { ...payload('match:m2') }, T1)];
    const out = merge({ slice, rows });
    expect((out.slice as TeamSlice).seasons.map((x) => x.id)).toEqual(['s1']);
    expect(out.team.base).not.toHaveProperty('match:m2');
  });

  it('keeps a set while its match stays (sets only go with their match)', () => {
    const slice = golden();
    const out = merge({ slice, rows: [row('set:m2/1', null)] });
    expect(out.slice).toBe(slice);
    expect(detectChanges(out.slice, out.team, T3).changes.map((c) => c.key)).toEqual(['set:m2/1']);
  });

  it('keeps a player who is in a played set', () => {
    const slice = golden();
    const out = merge({ slice, rows: [row('player:p8', null)] });
    expect((out.slice as TeamSlice).players.map((p) => p.id)).toContain('p8');
  });

  const withP20 = (s: TeamSlice): TeamSlice => ({
    ...s,
    players: [...s.players, { ...s.players[1], id: 'p20', number: 20 }],
    matches: s.matches.map((m) =>
      m.id === 'm2'
        ? { ...m, sets: [{ ...m.sets[0], slots: { ...m.sets[0].slots, 2: 'p20' } }] }
        : m,
    ),
    presets: s.presets.map((p) => (p.id === 'ps2' ? { ...p, slots: { ...p.slots, 1: 'p20' } } : p)),
  });

  it('removes a deleted player from unplayed sets and presets', () => {
    const slice = withP20(golden());
    const out = mergeRemote({
      teamId: 't1',
      slice,
      team: synced(slice),
      rows: [row('player:p20', null, T1)],
      local: { profileId: 'x' },
      foreignIds: new Set(),
    });
    const next = out.slice as TeamSlice;
    expect(next.players.map((p) => p.id)).not.toContain('p20');
    expect(next.matches[1].sets[0].slots[2]).toBeNull();
    expect(next.presets[1].slots[1]).toBeNull();
  });

  it('keeps a deleted player that a newer local preset change still uses', () => {
    const start = withP20(golden());
    const { slice, team } = locally(
      start,
      (s) => ({
        ...s,
        presets: s.presets.map((p) => (p.id === 'ps2' ? { ...p, name: 'New' } : p)),
      }),
      T2,
    );
    const out = merge({
      slice,
      team: { ...team, base: serverBase(start, T0) },
      rows: [row('player:p20', null, T1)],
    });
    expect((out.slice as TeamSlice).players.map((p) => p.id)).toContain('p20');
  });

  it('keeps a parent for a local child that was never noted', () => {
    const base = golden();
    const slice: TeamSlice = {
      ...base,
      matches: [...base.matches, { ...base.matches[1], id: 'm7' }],
    };
    const out = merge({ slice, team: synced(base), rows: [row('opponent:o3', null)] });
    expect((out.slice as TeamSlice).opponents.map((o) => o.id)).toContain('o3');
  });
});

describe('mergeRemote: players only this device lacks', () => {
  const withP20 = (s: TeamSlice): TeamSlice => ({
    ...s,
    players: [...s.players, { ...s.players[1], id: 'p20', number: 20 }],
  });
  const withoutP20 = (s: TeamSlice): TeamSlice => ({
    ...s,
    players: s.players.filter((p) => p.id !== 'p20'),
  });
  const captain = (id: string) => ({ ...payload('team:t1'), captainId: id });

  it('keeps references to a player deleted here that the server still has', () => {
    const start = withP20(golden());
    const { slice, team } = locally(start, withoutP20, T1);
    const out = merge({ slice, team, rows: [row('team:t1', captain('p20'), T2)] });
    const next = out.slice as TeamSlice;
    expect(next.team.captainId).toBe('p20');
    expect(out.issues).toEqual([{ kind: 'missingPlayer', playerIds: ['p20'] }]);
    expect(detectChanges(next, out.team, T3).changes.map((c) => c.key)).toEqual(['player:p20']);
  });

  it('keeps references to a player skipped as foreign', () => {
    const slice = golden();
    const set = payload('set:m2/1') as { slots: object };
    const rows = [
      row('player:p9', payload('player:p2')),
      row('set:m2/1', { ...set, slots: { ...set.slots, 2: 'p9' } }),
    ];
    const out = merge({ slice, rows, foreignIds: new Set(['player:p9']) });
    expect((out.slice as TeamSlice).matches[1].sets[0].slots[2]).toBe('p9');
    expect(out.skipped).toEqual([{ key: 'player:p9', reason: 'foreignId' }]);
  });

  it('keeps a newer played set intact and lets the other device bring the player back', () => {
    const start = withP20(golden());
    const { slice, team } = locally(start, withoutP20, T1);
    const set = payload('set:m2/1');
    const live = { ...set, events: [{ type: 'sub', outPlayerId: 'p1', inPlayerId: 'p20' }] };
    const out = merge({ slice, team, rows: [row('set:m2/1', live, T2)] });
    const next = out.slice as TeamSlice;
    expect(next.matches[1].sets[0].events).toEqual(live.events);
    expect(detectChanges(next, out.team, T3).changes.map((c) => c.key)).toEqual(['player:p20']);
  });
});

describe('mergeRemote: orphans', () => {
  it('takes a row under a parent this device deleted as deleted (no push loop)', () => {
    const dropM2 = (s: TeamSlice) => ({ ...s, matches: s.matches.filter((m) => m.id !== 'm2') });
    const { slice, team } = locally(golden(), dropM2, T1);
    const live: RecordPayload = {
      ...payload('set:m2/1'),
      events: [{ type: 'point', winner: 'us' }],
    };
    const incoming = row('set:m2/1', live, T2);
    const out = merge({ slice, team, rows: [incoming] });
    expect(out.slice).toBe(slice);
    expect(out.team.base['set:m2/1']).toEqual({ v: incoming.version, h: '', at: T2, del: true });
    expect(out.team.edits).not.toHaveProperty('set:m2/1');
    expect(detectChanges(out.slice, out.team, T3).changes.map((c) => c.key)).toEqual(['match:m2']);
    // Once the deletion of the match is on the server too, nothing is left to push.
    const pushed = {
      ...out.team,
      base: { ...out.team.base, 'match:m2': { v: 200, h: '', at: T1, del: true as const } },
      edits: {},
    };
    const again = row('set:m2/1', { ...live, weServeFirst: !live.weServeFirst }, T3);
    const later = merge({ slice, team: pushed, rows: [again] });
    expect(later.team.base['set:m2/1']).toMatchObject({ v: again.version, del: true });
    expect(detectChanges(later.slice, later.team, T3).changes).toEqual([]);
  });

  it('does not apply records whose parent is missing (no base)', () => {
    const slice = golden();
    const rows = [
      row('opponent:o9', { ...payload('opponent:o1'), seasonId: 'nope' }),
      row('match:m9', { ...payload('match:m1'), opponentId: 'nope' }),
      row('set:m9/1', payload('set:m2/1')),
      row('match:m8', payload('match:m1')),
      row('set:m7/1', payload('set:m2/1')),
    ];
    const out = merge({ slice, rows });
    expect(out.skipped.map((s) => s.key).sort()).toEqual([
      'match:m8',
      'match:m9',
      'opponent:o9',
      'set:m7/1',
      'set:m9/1',
    ]);
    expect(out.skipped.every((s) => s.reason === 'orphan')).toBe(true);
    expect(out.slice).toBe(slice);
    for (const s of out.skipped) expect(out.team.base).not.toHaveProperty(s.key);
  });

  it('keeps the local record (and its change) when an update would orphan it', () => {
    const { slice, team } = locally(
      golden(),
      (s) => ({ ...s, matches: s.matches.map((m) => (m.id === 'm2' ? { ...m, home: true } : m)) }),
      T1,
    );
    const moved = row('match:m2', { ...payload('match:m2'), opponentId: 'nope' }, T2);
    const out = merge({ slice, team, rows: [moved] });
    expect(out.slice).toBe(slice);
    expect(out.team.base['match:m2']).toEqual(team.base['match:m2']);
    expect(out.team.edits['match:m2']).toEqual(team.edits['match:m2']);
    expect(out.skipped).toEqual([{ key: 'match:m2', reason: 'orphan' }]);
  });

  it('downloads nothing without a team record', () => {
    const team = linkedTeam();
    const out = merge({ slice: undefined, team, rows: [row('player:p1', payload('player:p1'))] });
    expect(out.slice).toBeUndefined();
    expect(out.skipped).toEqual([{ key: 'player:p1', reason: 'orphan' }]);
    expect(out.team).toBe(team);
  });
});

describe('resetToCloudMerge (after a demotion)', () => {
  it('replaces local changes, drops local-only records and brings nothing back', () => {
    const base = golden();
    const { slice } = locally(
      base,
      (s) => ({
        ...withPlayer(s, 'p2', { firstName: 'Local' }),
        players: [
          ...withPlayer(s, 'p2', { firstName: 'Local' }).players,
          { ...s.players[1], id: 'p20', number: 20 },
        ],
        matches: s.matches.map((m) => (m.id === 'm2' ? { ...m, home: true } : m)),
      }),
      T3,
    );
    const team = synced(base);
    const rows = [...sliceToRecords(base)]
      .filter(([key]) => !key.endsWith('m2/1') && key !== 'match:m2' && !key.endsWith(':o3'))
      .map(([key, p], i) => row(key, p, T0, { version: i + 1 }));
    rows.push(row('opponent:o3', null, T1), row('match:m2', null, T1), row('set:m2/1', null, T1));
    const out = merge({ slice, team: { ...team, edits: {} }, rows, reset: true });
    const next = out.slice as TeamSlice;
    expect(next.players.map((p) => p.firstName)).toEqual(base.players.map((p) => p.firstName));
    expect(next.players.map((p) => p.id)).not.toContain('p20');
    expect(next.matches.map((m) => m.id)).toEqual(['m1']);
    expect(next.opponents.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(next.players[0].description).toBe(base.players[0].description);
  });

  it('drops local records the cloud left without a parent', () => {
    const base = golden();
    const rows = [...sliceToRecords(base)]
      .filter(([key]) => key !== 'opponent:o3')
      .map(([key, p], i) => row(key, p, T0, { version: i + 1 }));
    const out = merge({ slice: base, team: synced(base), rows, reset: true });
    const next = out.slice as TeamSlice;
    expect(next.opponents.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(next.matches.map((m) => m.id)).toEqual(['m1']);
    expect(out.skipped.map((s) => s.key)).toEqual(['match:m2', 'set:m2/1']);
  });

  // Audit H8 (review): after a reset the device may be made a manager, so `base` must describe
  // exactly what it has — otherwise the first change detection pushes the difference.
  describe('leaves nothing to push', () => {
    const all = (slice: TeamSlice) =>
      [...sliceToRecords(slice)].map(([key, p], i) => row(key, p, T0, { version: i + 1 }));
    const toPush = (out: ReturnType<typeof merge>) =>
      detectChanges(out.slice, { ...out.team, role: 'manager' }, T3).changes.map((c) => c.key);

    it('a `base` entry the cloud never had is dropped (a viewer that adopted an old copy)', () => {
      const base = golden();
      const extra = { ...base.players[1], id: 'p-old', number: 97 };
      const slice = { ...base, players: [...base.players, extra] };
      const team = linkedTeam({ role: 'player', base: serverBase(slice, T0) });
      expect(team.base['player:p-old']).toBeDefined();
      const out = merge({ slice, team, rows: all(base), reset: true });
      expect((out.slice as TeamSlice).players.map((p) => p.id)).not.toContain('p-old');
      expect(out.team.base['player:p-old']).toBeUndefined();
      expect(toPush(out)).toEqual([]);
    });

    it('a row that is invalid here keeps the device as it is: with and without the record', () => {
      const base = golden();
      const bad = { ...payload('player:p2'), firstName: 'x'.repeat(300) };
      const rows = all(base).map((r) => (r.id === 'p2' ? { ...r, payload: bad } : r));
      // The device has p2 (an older, valid copy): it stays, and isn't pushed back.
      const kept = merge({ slice: base, team: synced(base), rows, reset: true });
      expect(kept.skipped).toEqual([{ key: 'player:p2', reason: 'invalid' }]);
      expect((kept.slice as TeamSlice).players.map((p) => p.id)).toContain('p2');
      expect(kept.team.base['player:p2']).toMatchObject({ h: payloadHash(payload('player:p2')) });
      expect(toPush(kept)).toEqual([]);
      // The device lacks p3 and can't read the cloud's: it isn't pushed as deleted.
      const without = { ...base, players: base.players.filter((p) => p.id !== 'p3') };
      const rows3 = all(base).map((r) => (r.id === 'p3' ? { ...r, payload: bad } : r));
      const missing = merge({ slice: without, team: synced(base), rows: rows3, reset: true });
      expect(missing.team.base['player:p3']).toMatchObject({ h: '', del: true });
      expect(toPush(missing)).toEqual([]);
    });

    it('an invalid row of another kind is left as it is on the device too', () => {
      const base = golden();
      const seasonKey = [...sliceToRecords(base).keys()].find((k) => k.startsWith('season:'));
      if (!seasonKey) throw new Error('no season');
      const bad = { ...payload(seasonKey), name: 'x'.repeat(300) };
      const rows = all(base).map((r) =>
        `${r.kind}:${r.id}` === seasonKey ? { ...r, payload: bad } : r,
      );
      const out = merge({ slice: base, team: synced(base), rows, reset: true });
      expect(out.skipped).toEqual([{ key: seasonKey, reason: 'invalid' }]);
      expect(out.slice).toBe(base);
      expect(toPush(out)).toEqual([]);
    });

    it('a row whose id belongs to another local team isn’t pushed as deleted either', () => {
      const base = golden();
      const without = { ...base, players: base.players.filter((p) => p.id !== 'p3') };
      const out = merge({
        slice: without,
        team: synced(base),
        rows: all(base),
        foreignIds: new Set(['player:p3']),
        reset: true,
      });
      expect(out.skipped).toEqual([{ key: 'player:p3', reason: 'foreignId' }]);
      expect(out.team.base['player:p3']).toMatchObject({ del: true });
      expect(toPush(out)).toEqual([]);
    });

    it('records the cloud has without their parent count as deleted here', () => {
      const base = golden();
      const rows = all(base).filter((r) => r.kind !== 'opponent' || r.id !== 'o3');
      const out = merge({ slice: base, team: synced(base), rows, reset: true });
      expect(out.team.base['match:m2']).toMatchObject({ del: true });
      expect(out.team.base['opponent:o3']).toBeUndefined();
      expect(toPush(out)).toEqual([]);
    });
  });

  it('does nothing without the team row (a partial pull would drop records)', () => {
    const base = golden();
    const team = synced(base);
    const rows = [row('player:p2', { ...payload('player:p2'), firstName: 'Cloud' })];
    const out = merge({ slice: base, team, rows, reset: true });
    expect(out).toEqual({ slice: base, team, skipped: [], issues: [] });
    expect(out.slice).toBe(base);
    expect(out.team).toBe(team);
  });
});

describe('applyPushResults', () => {
  const change = (key: string, p: RecordPayload | null, at = T1): LocalChange => {
    const { kind, id } = parseRecordKey(key) as NonNullable<ReturnType<typeof parseRecordKey>>;
    return { key, kind, id, payload: p, hash: p === null ? '' : payloadHash(p), at };
  };
  const result = (
    c: LocalChange,
    applied: boolean,
    v: number,
    extra: Partial<PushOutcome> = {},
  ) => ({
    kind: c.kind,
    id: c.id,
    applied,
    version: v,
    at: c.at,
    updatedAt: c.at,
    deleted: c.payload === null,
    ...extra,
  });

  it('records applied pushes in base and forgets their edits', () => {
    const p2 = change('player:p2', { ...payload('player:p2'), firstName: 'Bea' });
    const gone = change('preset:ps2', null);
    const team = linkedTeam({
      edits: { [p2.key]: { at: T1, h: p2.hash }, [gone.key]: { at: T1, h: '' } },
    });
    const out = applyPushResults(
      team,
      [p2, gone],
      [result(p2, true, 7, { at: '2026-11-26T10:05:00.000123+00:00' }), result(gone, true, 8)],
    );
    expect(out.team.base).toEqual({
      'player:p2': { v: 7, h: p2.hash, at: T1 },
      'preset:ps2': { v: 8, h: '', at: T1, del: true },
    });
    expect(out.team.edits).toEqual({});
    expect(out.stale).toEqual([]);
  });

  it('keeps an edit made while the push was on its way', () => {
    const p2 = change('player:p2', { ...payload('player:p2'), firstName: 'Bea' });
    const team = linkedTeam({ edits: { [p2.key]: { at: T2, h: 'newer' } } });
    const out = applyPushResults(team, [p2], [result(p2, true, 7)]);
    expect(out.team.edits).toEqual(team.edits);
  });

  it('returns what the server kept instead as stale rows', () => {
    const p2 = change('player:p2', { ...payload('player:p2'), firstName: 'Bea' });
    const gone = change('preset:ps2', null);
    const theirs = { ...payload('player:p2'), firstName: 'Server' };
    const out = applyPushResults(
      linkedTeam(),
      [p2, gone],
      [
        result(p2, false, 9, {
          payload: theirs,
          at: T2,
          updatedAt: 'not a time',
          deviceId: 'devB',
        }),
        result(gone, false, 10, { deleted: false }),
      ],
    );
    expect(out.stale).toEqual([
      {
        kind: 'player',
        id: 'p2',
        payload: theirs,
        deleted: false,
        at: T2,
        updatedAt: 'not a time',
        version: 9,
        deviceId: 'devB',
      },
      expect.objectContaining({ id: 'ps2', payload: null, version: 10, deviceId: '' }),
    ]);
    expect(out.team.base).toEqual({});
  });

  it('ignores results for records it did not push', () => {
    const p2 = change('player:p2', payload('player:p2'));
    expect(applyPushResults(linkedTeam(), [], [result(p2, true, 7)]).team.base).toEqual({});
  });

  describe('the server kept a save this device already had (version ≤ base)', () => {
    const p2 = change('player:p2', { ...payload('player:p2'), firstName: 'Second' });
    const known = { 'player:p2': { v: 9, h: 'first', at: T2 } };

    it('re-stamps the change just after it (clock went back) instead of a stale row', () => {
      const team = linkedTeam({ base: known, edits: { [p2.key]: { at: T0, h: p2.hash } } });
      const out = applyPushResults(team, [p2], [result(p2, false, 9, { at: T2 })]);
      expect(out.stale).toEqual([]);
      expect(out.team.edits[p2.key]).toEqual({ at: '2026-11-26T10:09:00.001Z', h: p2.hash });
      expect(out.team.base).toEqual(known);
    });

    it('also for a deletion saved in the same millisecond', () => {
      const gone = change('player:p2', null, T2);
      const team = linkedTeam({ base: known, edits: { [gone.key]: { at: T2, h: '' } } });
      const out = applyPushResults(team, [gone], [result(gone, false, 9, { deleted: false })]);
      expect(out.stale).toEqual([]);
      expect(out.team.edits[gone.key]).toEqual({ at: '2026-11-26T10:09:00.001Z', h: '' });
    });

    it('keeps an edit that is already later, or when the server time is unreadable', () => {
      const edits = { [p2.key]: { at: T3, h: p2.hash } };
      const team = linkedTeam({ base: known, edits });
      expect(applyPushResults(team, [p2], [result(p2, false, 9, { at: T2 })]).team.edits).toEqual(
        edits,
      );
      const early = linkedTeam({ base: known, edits: { [p2.key]: { at: T0, h: p2.hash } } });
      const out = applyPushResults(early, [p2], [result(p2, false, 8, { at: 'never' })]);
      expect(out.team.edits).toEqual(early.edits);
      expect(out.stale).toEqual([]);
    });

    it('a newer version than base, or no edit: a stale row as before', () => {
      const team = linkedTeam({ base: known, edits: { [p2.key]: { at: T0, h: p2.hash } } });
      expect(applyPushResults(team, [p2], [result(p2, false, 10)]).stale).toHaveLength(1);
      const noEdit = linkedTeam({ base: known });
      expect(applyPushResults(noEdit, [p2], [result(p2, false, 9)]).stale).toHaveLength(1);
    });
  });

  it('keeps a save time it cannot read as it is', () => {
    const p2 = change('player:p2', payload('player:p2'));
    const out = applyPushResults(linkedTeam(), [p2], [result(p2, true, 7, { at: 'later' })]);
    expect(out.team.base['player:p2'].at).toBe('later');
  });
});

describe('nextCursor', () => {
  const at = (iso: string, v: number) =>
    row('player:p1', payload('player:p1'), iso, { version: v, updatedAt: iso });

  it('moves to the last row written more than 10 s before the server time', () => {
    const rows = [
      at('2026-11-26T10:00:00.000Z', 5),
      at('2026-11-26T10:00:49.000Z', 6),
      at('2026-11-26T10:00:55.000Z', 7),
    ];
    expect(nextCursor(1, rows, '2026-11-26T10:01:00.000000+00:00')).toBe(6);
    expect(nextCursor(1, [rows[2], rows[0], rows[1]], '2026-11-26T10:01:00Z')).toBe(6);
    expect(nextCursor(1, rows, '2026-11-26T10:01:00Z', 0)).toBe(7);
  });

  it('stays without rows, with only recent rows or with a broken server time', () => {
    expect(nextCursor(4, [], '2026-11-26T10:01:00Z')).toBe(4);
    expect(nextCursor(4, [at('2026-11-26T10:00:59.000Z', 9)], '2026-11-26T10:01:00Z')).toBe(4);
    expect(nextCursor(4, [at('2026-11-26T10:00:00.000Z', 9)], 'soon')).toBe(4);
    expect(nextCursor(12, [at('2026-11-26T10:00:00.000Z', 9)], '2026-11-26T10:01:00Z')).toBe(12);
  });
});

describe('adoptExisting', () => {
  it('marks every record as changed at the epoch, so the cloud wins where both have it', () => {
    const slice = golden();
    const edits = adoptExisting(slice);
    expect(Object.keys(edits)).toEqual([...recs.keys()]);
    expect(Object.values(edits).every((e) => e.at === EPOCH)).toBe(true);
    const team = linkedTeam({ edits });
    const changes = detectChanges(slice, team, T3).changes;
    expect(changes.every((c) => c.at === EPOCH)).toBe(true);
    const rows = [
      row('team:t1', payload('team:t1')),
      row('player:p2', { ...payload('player:p2'), firstName: 'Cloud' }),
    ];
    const out = merge({ slice, team, rows });
    expect((out.slice as TeamSlice).players[1].firstName).toBe('Cloud');
    expect(detectChanges(out.slice, out.team, T3).changes).toHaveLength(recs.size - 2);
  });
});

describe('a merged team stays consistent', () => {
  it('passes isConsistent after concurrent edits are merged and repaired', () => {
    const data: TeamData = goldenTeamData();
    const slice = sliceOf(data, 't1');
    const rows = [
      row('season:s9', { ...payload('season:s1'), name: '2026/27 ' }),
      row('opponent:o9', { ...payload('opponent:o1'), seasonId: 's9', name: 'RIVALS' }),
      row('match:m9', { ...payload('match:m1'), seasonId: 's9', opponentId: 'o9' }),
      row('set:m9/1', payload('set:m2/1')),
      row('preset:ps9', { ...payload('preset:ps2'), createdAt: '2026-12-01T00:00:00.000Z' }),
      row('player:p3', null),
    ];
    const out = merge({ slice, rows });
    const next = out.slice as TeamSlice;
    expect(isConsistent(sliceTransfer(next))).toBe(true);
    expect(out.issues.map((i) => i.kind)).toEqual(['merged', 'merged', 'renamed']);
    expect(replaceTeamSlice(data, 't1', next)).not.toBe(data);
  });
});
