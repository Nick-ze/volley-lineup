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

function merge(input: Partial<MergeInput> & { slice: TeamSlice | undefined }) {
  return mergeRemote({
    teamId: 't1',
    team: input.slice ? synced(input.slice) : linkedTeam(),
    rows: [],
    local: { profileId: 'prX' },
    foreignIds: new Set(),
    ...input,
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

describe('mergeRemote: orphans', () => {
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

describe("mergeRemote: 'cloudWins' (after a demotion)", () => {
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
    const out = merge({ slice, team: { ...team, edits: {} }, rows, mode: 'cloudWins' });
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
    const out = merge({ slice: base, team: synced(base), rows, mode: 'cloudWins' });
    const next = out.slice as TeamSlice;
    expect(next.opponents.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(next.matches.map((m) => m.id)).toEqual(['m1']);
    expect(out.skipped.map((s) => s.key)).toEqual(['match:m2', 'set:m2/1']);
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
        result(p2, false, 9, { payload: theirs, at: T2, updatedAt: 'not a time' }),
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
        deviceId: '',
      },
      expect.objectContaining({ id: 'ps2', payload: null, version: 10 }),
    ]);
    expect(out.team.base).toEqual({});
  });

  it('ignores results for records it did not push', () => {
    const p2 = change('player:p2', payload('player:p2'));
    expect(applyPushResults(linkedTeam(), [], [result(p2, true, 7)]).team.base).toEqual({});
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
