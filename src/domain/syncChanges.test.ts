import { goldenTeamData, linkedTeam, sliceOf } from '@/test-utils/syncFixtures';

import {
  batchBytes,
  detectChanges,
  edgePhotoIds,
  groupSignature,
  halveBatch,
  pendingCount,
  pushBatches,
  pushGroups,
  PUSH_LIMITS,
  recordLabel,
  sendableChanges,
  type LocalChange,
} from './syncChanges';
import { payloadHash, replaceTeamSlice, sliceToRecords, type TeamData } from './syncRecords';
import type { SyncBase, SyncData, SyncedTeam } from './types';

const T0 = '2026-11-26T10:00:00.000Z';
const T1 = '2026-11-26T10:05:00.000Z';
const T2 = '2026-11-26T10:09:00.000Z';

/** The team as the server has it: every record in `base`. */
function syncedWith(data: TeamData, teamId: string, overrides: Partial<SyncedTeam> = {}) {
  const base: Record<string, SyncBase> = {};
  let v = 0;
  for (const [key, payload] of sliceToRecords(sliceOf(data, teamId))) {
    v += 1;
    base[key] = { v, h: payloadHash(payload), at: T0 };
  }
  return linkedTeam({ base, ...overrides });
}

const renameP2 = (data: TeamData, firstName: string): TeamData => ({
  ...data,
  players: data.players.map((p) => (p.id === 'p2' ? { ...p, firstName } : p)),
});

describe('detectChanges', () => {
  it('unlinks a team that is gone from the device, without tombstones', () => {
    const team = syncedWith(goldenTeamData(), 't1');
    const result = detectChanges(undefined, team, T1);
    expect(result).toEqual({ changes: [], edits: team.edits, unlinked: true });
    expect(result.edits).toBe(team.edits);
  });

  it('never pushes for viewers', () => {
    const data = goldenTeamData();
    const team = linkedTeam({ role: 'player' });
    const result = detectChanges(sliceOf(data, 't1'), team, T1);
    expect(result.changes).toEqual([]);
    expect(result.edits).toBe(team.edits);
  });

  it('marks every record of a newly linked team, in push order', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const { changes, edits, unlinked } = detectChanges(slice, linkedTeam(), T1);
    expect(unlinked).toBe(false);
    expect(changes).toHaveLength(22);
    expect(changes.map((c) => c.kind)).toEqual([
      'team',
      'season',
      'season',
      'opponent',
      'opponent',
      'opponent',
      ...Array<string>(8).fill('player'),
      'match',
      'match',
      'set',
      'set',
      'set',
      'set',
      'preset',
      'starters',
    ]);
    expect(changes[0]).toEqual({
      key: 'team:t1',
      kind: 'team',
      id: 't1',
      payload: sliceToRecords(slice).get('team:t1'),
      hash: payloadHash(sliceToRecords(slice).get('team:t1')!),
      at: T1,
    });
    expect(Object.keys(edits)).toHaveLength(22);
    expect(edits['set:m1/1']).toEqual({ at: T1, h: changes[16].hash });
  });

  it('finds nothing in an unchanged team and keeps the same edits object', () => {
    const data = goldenTeamData();
    const team = syncedWith(data, 't1');
    const result = detectChanges(sliceOf(data, 't1'), team, T1);
    expect(result.changes).toEqual([]);
    expect(result.edits).toBe(team.edits);
  });

  it('checks an unchanged team again without hashing anything (cached per object)', () => {
    const data = goldenTeamData();
    const team = syncedWith(data, 't1');
    detectChanges(sliceOf(data, 't1'), team, T1);
    const stringify = jest.spyOn(JSON, 'stringify');
    const renamed = renameP2(data, 'Bea');
    expect(detectChanges(sliceOf(data, 't1'), team, T1).changes).toEqual([]);
    expect(stringify).not.toHaveBeenCalled();
    expect(detectChanges(sliceOf(renamed, 't1'), team, T1).changes).toHaveLength(1);
    // Only the changed player is hashed.
    expect(stringify.mock.calls.length).toBeLessThan(20);
    stringify.mockRestore();
  });

  it('stamps a change when first seen and keeps its time while unchanged', () => {
    const data = renameP2(goldenTeamData(), 'Bea');
    const team = syncedWith(goldenTeamData(), 't1');
    const first = detectChanges(sliceOf(data, 't1'), team, T1);
    expect(first.changes.map((c) => [c.key, c.at])).toEqual([['player:p2', T1]]);
    const again = detectChanges(sliceOf(data, 't1'), { ...team, edits: first.edits }, T2);
    expect(again.changes[0].at).toBe(T1);
    expect(again.edits).toBe(first.edits);
  });

  it('restamps a record changed again and forgets an undo back to the server', () => {
    const team = syncedWith(goldenTeamData(), 't1');
    const first = detectChanges(sliceOf(renameP2(goldenTeamData(), 'Bea'), 't1'), team, T1);
    const second = detectChanges(
      sliceOf(renameP2(goldenTeamData(), 'Bia'), 't1'),
      { ...team, edits: first.edits },
      T2,
    );
    expect(second.changes[0].at).toBe(T2);
    const undone = detectChanges(
      sliceOf(goldenTeamData(), 't1'),
      { ...team, edits: second.edits },
      T2,
    );
    expect(undone.changes).toEqual([]);
    expect(undone.edits).toEqual({});
  });

  it('turns a record removed while the team is there into a tombstone (time kept)', () => {
    const data = goldenTeamData();
    const team = syncedWith(data, 't1');
    const without = { ...data, presets: data.presets.filter((p) => p.id !== 'ps2') };
    const first = detectChanges(sliceOf(without, 't1'), team, T1);
    expect(first.changes).toEqual([
      { key: 'preset:ps2', kind: 'preset', id: 'ps2', payload: null, hash: '', at: T1 },
    ]);
    const again = detectChanges(sliceOf(without, 't1'), { ...team, edits: first.edits }, T2);
    expect(again.changes[0].at).toBe(T1);
  });

  it('knows tombstones the server has and records that came back', () => {
    const data = goldenTeamData();
    const team = syncedWith(data, 't1');
    const base = { ...team.base, 'preset:ps2': { v: 99, h: '', at: T0, del: true as const } };
    const without = { ...data, presets: data.presets.filter((p) => p.id !== 'ps2') };
    expect(detectChanges(sliceOf(without, 't1'), { ...team, base }, T1).changes).toEqual([]);
    const back = detectChanges(sliceOf(data, 't1'), { ...team, base }, T1);
    expect(back.changes.map((c) => c.key)).toEqual(['preset:ps2']);
  });

  it('forgets an edit of a record created and removed before it was pushed', () => {
    const data = goldenTeamData();
    const team = syncedWith(data, 't1', { edits: { 'player:gone': { at: T0, h: 'abc' } } });
    const result = detectChanges(sliceOf(data, 't1'), team, T1);
    expect(result.changes).toEqual([]);
    expect(result.edits).toEqual({});
  });
});

describe('pendingCount', () => {
  it('counts the changes of the editable shared teams of an account', () => {
    const data = renameP2(goldenTeamData(), 'Bea');
    const sync: SyncData = {
      deviceId: 'd1',
      account: null,
      teams: {
        t1: syncedWith(goldenTeamData(), 't1'),
        t2: linkedTeam({ userId: 'u2' }),
        gone: linkedTeam(),
      },
    };
    const t2Records = sliceToRecords(sliceOf(data, 't2')).size;
    expect(pendingCount(sync, data, 'u1')).toBe(1);
    expect(pendingCount(sync, data, 'u2')).toBe(t2Records);
    expect(pendingCount(sync, data, null)).toBe(1 + t2Records);
    expect(pendingCount(sync, data, 'u3')).toBe(0);
    const viewer = { ...sync, teams: { t2: linkedTeam({ role: 'player' }) } };
    expect(pendingCount(viewer, data, null)).toBe(0);
  });
});

const ch = (kind: LocalChange['kind'], id: string, size = 10): LocalChange => ({
  key: `${kind}:${id}`,
  kind,
  id,
  payload: { x: 'y'.repeat(size) },
  hash: 'h',
  at: T0,
});

describe('pushBatches', () => {
  it('splits by count, keeping the order', () => {
    const changes = Array.from({ length: 5 }, (_, i) => ch('player', `p${i}`));
    const batches = pushBatches(changes, { count: 2, bytes: 1e6 });
    expect(batches.map((b) => b.map((c) => c.id))).toEqual([['p0', 'p1'], ['p2', 'p3'], ['p4']]);
  });

  it('splits by size', () => {
    const changes = [ch('player', 'a', 450), ch('player', 'b', 450), ch('player', 'c', 10)];
    const batches = pushBatches(changes, { count: 100, bytes: 1000 });
    expect(batches.map((b) => b.map((c) => c.id))).toEqual([['a'], ['b', 'c']]);
  });

  it('keeps a match together with its sets, and an oversized group alone', () => {
    const changes = [
      ch('player', 'p1'),
      ch('match', 'm1'),
      ch('match', 'm2'),
      ch('set', 'm1/1'),
      ch('set', 'm1/2'),
      ch('set', 'm2/1'),
      ch('set', 'm3/1'),
      { ...ch('preset', 'x'), payload: null, hash: '' },
    ];
    const batches = pushBatches(changes, { count: 3, bytes: 1e6 });
    expect(batches.map((b) => b.map((c) => c.id))).toEqual([
      ['p1'],
      ['m1', 'm1/1', 'm1/2'],
      ['m2', 'm2/1', 'm3/1'],
      ['x'],
    ]);
    expect(
      pushBatches([ch('match', 'm'), ch('set', 'm/1'), ch('set', 'm/2')], { count: 2, bytes: 1e6 }),
    ).toEqual([[ch('match', 'm'), ch('set', 'm/1'), ch('set', 'm/2')]]);
  });

  it('uses 100 records and 512 KB by default and returns nothing for no changes', () => {
    expect(PUSH_LIMITS).toEqual({ count: 100, bytes: 512 * 1024 });
    const many = Array.from({ length: 150 }, (_, i) => ch('player', `p${i}`));
    expect(pushBatches(many).map((b) => b.length)).toEqual([100, 50]);
    expect(pushBatches([])).toEqual([]);
  });
});

describe('edgePhotoIds', () => {
  it('lists photos of team and player changes the cloud folder lacks, each once', () => {
    const changes: LocalChange[] = [
      { ...ch('team', 't1'), payload: { photoId: 'ph3' } },
      { ...ch('player', 'p1'), payload: { photoId: 'ph2' } },
      { ...ch('player', 'p2'), payload: { photoId: 'ph2' } },
      { ...ch('player', 'p3'), payload: { photoId: 'known' } },
      { ...ch('player', 'p4'), payload: {} },
      { ...ch('player', 'p5'), payload: null, hash: '' },
      { ...ch('season', 's1'), payload: { photoId: 'ph9' } },
    ];
    expect(edgePhotoIds(changes, ['known'])).toEqual(['ph3', 'ph2']);
  });
});

describe('a whole team', () => {
  it('has nothing to push once the server has everything', () => {
    const data = goldenTeamData();
    const team = syncedWith(data, 't1');
    const replaced = replaceTeamSlice(data, 't1', sliceOf(data, 't1'));
    expect(detectChanges(sliceOf(replaced, 't1'), team, T1).changes).toEqual([]);
  });
});

/* ------------------------------------------------------------ v10 audit M3, M4, M5 */

/** Every record of the golden team t1 as a change of a newly linked team (push order). */
const allChanges = (data: TeamData = goldenTeamData()): LocalChange[] =>
  detectChanges(sliceOf(data, 't1'), linkedTeam(), T1).changes;

const keysOf = (changes: readonly LocalChange[]) => changes.map((c) => c.key);

const LONG = 'x'.repeat(201);

describe('pushGroups', () => {
  it('keeps a match with its sets and everything else alone, in order', () => {
    const groups = pushGroups(allChanges());
    expect(groups.map(keysOf)).toEqual([
      ['team:t1'],
      ['season:s1'],
      ['season:s2'],
      ['opponent:o1'],
      ['opponent:o2'],
      ['opponent:o3'],
      ...['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((id) => [`player:${id}`]),
      ['match:m1', 'set:m1/1', 'set:m1/2', 'set:m1/3'],
      ['match:m2', 'set:m2/1'],
      ['preset:ps2'],
      ['starters:t1'],
    ]);
  });

  it('a set whose match isn’t among the changes travels alone', () => {
    const sets = allChanges().filter((c) => c.kind === 'set');
    expect(pushGroups(sets).map(keysOf)).toEqual(sets.map((c) => [c.key]));
    expect(pushGroups([])).toEqual([]);
  });
});

describe('halveBatch (audit M5)', () => {
  it('splits a batch into smaller ones, groups kept whole and nothing lost', () => {
    const batch = allChanges();
    const halves = halveBatch(batch);
    expect(halves.length).toBeGreaterThanOrEqual(2);
    expect(halves.flat()).toEqual(pushGroups(batch).flat());
    const half = Math.ceil(batchBytes(batch) / 2);
    for (const part of halves) {
      // Only a single group may be bigger than half.
      if (pushGroups(part).length > 1) expect(batchBytes(part)).toBeLessThanOrEqual(half);
    }
    const m1 = halves.find((part) => part.some((c) => c.key === 'match:m1'));
    expect(keysOf(m1 ?? [])).toEqual(
      expect.arrayContaining(['match:m1', 'set:m1/1', 'set:m1/2', 'set:m1/3']),
    );
  });

  it('two groups always part; one group can’t be split', () => {
    const [team, season] = allChanges();
    expect(halveBatch([team, season])).toEqual([[team], [season]]);
    const match = allChanges().filter((c) => c.key === 'match:m1' || c.key.startsWith('set:m1/'));
    expect(halveBatch(match)).toEqual([match]);
  });

  it('batchBytes adds up the changes (a deletion is small)', () => {
    const [team, season] = allChanges();
    expect(batchBytes([])).toBe(0);
    expect(batchBytes([team, season])).toBe(batchBytes([team]) + batchBytes([season]));
    const gone: LocalChange = { ...season, payload: null, hash: '' };
    expect(batchBytes([gone])).toBe(4 + gone.key.length + 64);
  });
});

describe('groupSignature', () => {
  it('changes when any record of the group or its content changes', () => {
    const group = allChanges().filter((c) => c.key === 'match:m2' || c.key === 'set:m2/1');
    const signature = groupSignature(group);
    expect(signature).toBe(`match:m2@${group[0].hash}|set:m2/1@${group[1].hash}`);
    expect(groupSignature([group[0], { ...group[1], hash: 'other' }])).not.toBe(signature);
    expect(groupSignature([group[0]])).not.toBe(signature);
  });
});

describe('sendableChanges (audit M3, M4)', () => {
  const withPlayer = (firstName: string): TeamData => renameP2(goldenTeamData(), firstName);
  const reasons = (held: ReturnType<typeof sendableChanges>['held']) =>
    Object.fromEntries(held.map((h) => [h.change.key, h.reason]));

  it('sends everything of a team this app could read back itself', () => {
    const changes = allChanges();
    const { ready, held } = sendableChanges(changes, {}, 't1');
    expect(ready).toEqual(pushGroups(changes).flat());
    expect(held).toEqual([]);
  });

  it('holds a record with a name over 200 characters; the rest goes', () => {
    const changes = allChanges(withPlayer(LONG));
    const { ready, held } = sendableChanges(changes, {}, 't1');
    expect(reasons(held)).toEqual({ 'player:p2': 'invalid' });
    expect(keysOf(ready)).toEqual(
      keysOf(pushGroups(changes).flat()).filter((k) => k !== 'player:p2'),
    );
  });

  it('a name of exactly 200 characters still goes', () => {
    const changes = allChanges(withPlayer('x'.repeat(200)));
    expect(sendableChanges(changes, {}, 't1').held).toEqual([]);
  });

  it('holds everything of a new team whose own record can’t be sent', () => {
    const data = goldenTeamData();
    const long = { ...data, teams: data.teams.map((t) => ({ ...t, name: LONG })) };
    const changes = allChanges(long);
    const { ready, held } = sendableChanges(changes, {}, 't1');
    expect(ready).toEqual([]);
    expect(held).toHaveLength(22);
    expect(reasons(held)['team:t1']).toBe('invalid');
    expect(new Set(held.slice(1).map((h) => h.reason))).toEqual(new Set(['parent']));
  });

  it('an edit of a team the server already has holds only itself', () => {
    const data = goldenTeamData();
    const long = { ...data, teams: data.teams.map((t) => ({ ...t, name: LONG })) };
    const changes = allChanges(long);
    const base = { 'team:t1': { v: 1, h: 'old', at: T0 } };
    const { ready, held } = sendableChanges(changes, base, 't1');
    expect(reasons(held)).toEqual({ 'team:t1': 'invalid' });
    expect(ready).toHaveLength(21);
  });

  it('a team record the server only has as deleted counts as new', () => {
    const data = goldenTeamData();
    const long = { ...data, teams: data.teams.map((t) => ({ ...t, name: LONG })) };
    const base = { 'team:t1': { v: 1, h: '', at: T0, del: true as const } };
    expect(sendableChanges(allChanges(long), base, 't1').ready).toEqual([]);
  });

  it('holds what is below a new season that waits: its opponents, their matches and sets', () => {
    const data = goldenTeamData();
    const long = {
      ...data,
      seasons: data.seasons.map((x) => (x.id === 's2' ? { ...x, name: LONG } : x)),
    };
    const { ready, held } = sendableChanges(allChanges(long), {}, 't1');
    expect(reasons(held)).toEqual({
      'season:s2': 'invalid',
      'opponent:o3': 'parent',
      'match:m2': 'parent',
      'set:m2/1': 'parent',
    });
    expect(ready).toHaveLength(18);
    expect(keysOf(ready)).toContain('match:m1');
  });

  it('a new match waits with all its sets when one of them can’t be sent', () => {
    const data = goldenTeamData();
    // Set 2 of m1 with a broken payload (its `setNumber` isn't the id's).
    const broken = {
      ...data,
      matches: data.matches.map((m) =>
        m.id === 'm1'
          ? {
              ...m,
              sets: m.sets.map((x) => (x.setNumber === 2 ? { ...x, liberoId: 7 as never } : x)),
            }
          : m,
      ),
    };
    const { ready, held } = sendableChanges(allChanges(broken), {}, 't1');
    expect(reasons(held)).toEqual({
      'match:m1': 'parent',
      'set:m1/1': 'parent',
      'set:m1/2': 'invalid',
      'set:m1/3': 'parent',
    });
    expect(keysOf(ready)).toContain('match:m2');
    // A match the server already has: only the broken set waits, the others still go.
    const base = { 'match:m1': { v: 3, h: 'old', at: T0 } };
    const known = sendableChanges(allChanges(broken), base, 't1');
    expect(reasons(known.held)).toEqual({ 'set:m1/2': 'invalid' });
  });

  it('a match record that can’t be sent doesn’t hold its sets once the server has the match', () => {
    const data = goldenTeamData();
    const long = {
      ...data,
      matches: data.matches.map((m) => (m.id === 'm1' ? { ...m, opponent: LONG } : m)),
    };
    const fresh = sendableChanges(allChanges(long), {}, 't1');
    expect(Object.keys(reasons(fresh.held))).toEqual([
      'match:m1',
      'set:m1/1',
      'set:m1/2',
      'set:m1/3',
    ]);
    const base = { 'match:m1': { v: 3, h: 'old', at: T0 } };
    const known = sendableChanges(allChanges(long), base, 't1');
    expect(reasons(known.held)).toEqual({ 'match:m1': 'invalid' });
    expect(keysOf(known.ready)).toEqual(
      expect.arrayContaining(['set:m1/1', 'set:m1/2', 'set:m1/3']),
    );
  });

  it('holds a group the server refused with exactly this content, and what is new below it', () => {
    const changes = allChanges();
    const opponent = changes.filter((c) => c.key === 'opponent:o3');
    const refused = new Set([groupSignature(opponent)]);
    const { ready, held } = sendableChanges(changes, {}, 't1', refused);
    expect(reasons(held)).toEqual({
      'opponent:o3': 'refused',
      'match:m2': 'parent',
      'set:m2/1': 'parent',
    });
    expect(ready).toHaveLength(19);
    // Once the record has changed it is tried again.
    const data = goldenTeamData();
    const renamed = {
      ...data,
      opponents: data.opponents.map((o) => (o.id === 'o3' ? { ...o, name: 'Renamed' } : o)),
    };
    expect(sendableChanges(allChanges(renamed), {}, 't1', refused).held).toEqual([]);
  });

  it('a refused match group waits as a whole and is tried again when one set has changed', () => {
    const changes = allChanges();
    const group = changes.filter((c) => c.key === 'match:m2' || c.key === 'set:m2/1');
    const refused = new Set([groupSignature(group)]);
    const first = sendableChanges(changes, {}, 't1', refused);
    expect(reasons(first.held)).toEqual({ 'match:m2': 'refused', 'set:m2/1': 'refused' });
    const changed = changes.map((c) => (c.key === 'set:m2/1' ? { ...c, hash: 'new' } : c));
    expect(sendableChanges(changed, {}, 't1', refused).held).toEqual([]);
  });

  it('a record refused on its own waits alone when the server already has its match', () => {
    const changes = allChanges();
    const set = changes.filter((c) => c.key === 'set:m1/2');
    const refused = new Set([groupSignature(set)]);
    const base = { 'match:m1': { v: 3, h: 'old', at: T0 } };
    const known = sendableChanges(changes, base, 't1', refused);
    expect(reasons(known.held)).toEqual({ 'set:m1/2': 'refused' });
    // A new match still waits with all its sets.
    const fresh = sendableChanges(changes, {}, 't1', refused);
    expect(reasons(fresh.held)).toEqual({
      'match:m1': 'parent',
      'set:m1/1': 'parent',
      'set:m1/2': 'refused',
      'set:m1/3': 'parent',
    });
  });

  it('deletions always go, also below a record that waits; a refused deletion waits', () => {
    const data = goldenTeamData();
    const team = syncedWith(data, 't1');
    const long = {
      ...data,
      seasons: data.seasons.map((x) => (x.id === 's2' ? { ...x, name: LONG } : x)),
      matches: data.matches.filter((m) => m.id !== 'm2'),
    };
    const { changes } = detectChanges(sliceOf(long, 't1'), team, T1);
    expect(keysOf(changes)).toEqual(['season:s2', 'match:m2', 'set:m2/1']);
    const plan = sendableChanges(changes, team.base, 't1');
    expect(reasons(plan.held)).toEqual({ 'season:s2': 'invalid' });
    expect(keysOf(plan.ready)).toEqual(['match:m2', 'set:m2/1']);
    const refused = new Set([groupSignature(changes.slice(1))]);
    const again = sendableChanges(changes, team.base, 't1', refused);
    expect(reasons(again.held)).toEqual({
      'season:s2': 'invalid',
      'match:m2': 'refused',
      'set:m2/1': 'refused',
    });
  });
});

describe('sendableChanges: the deletion of a season or an opponent (review of the audit’s push PR)', () => {
  const reasons = (held: ReturnType<typeof sendableChanges>['held']) =>
    Object.fromEntries(held.map((h) => [h.change.key, h.reason]));
  const data = goldenTeamData();
  const team = syncedWith(data, 't1');
  const plan = (next: TeamData, refused?: ReadonlySet<string>) => {
    const { changes } = detectChanges(sliceOf(next, 't1'), team, T1);
    return { changes, ...sendableChanges(changes, team.base, 't1', refused) };
  };
  /** m1 (the server has it under o1) now belongs to `opponent`, and o1 is deleted. */
  const movedM1 = (opponent: TeamData['opponents'][number]): TeamData => ({
    ...data,
    opponents: [...data.opponents.filter((o) => o.id !== 'o1'), opponent],
    matches: data.matches.map((m) =>
      m.id === 'm1' ? { ...m, opponentId: opponent.id, opponent: 'New VC' } : m,
    ),
  });
  const newOpponent = (name: string) => ({ ...data.opponents[0], id: 'ox', name });

  it('waits while the move of a match the server has waits: other devices still have it there', () => {
    const { ready, held } = plan(movedM1(newOpponent(LONG)));
    expect(reasons(held)).toEqual({
      'opponent:ox': 'invalid',
      'match:m1': 'parent',
      'opponent:o1': 'parent',
    });
    expect(ready).toEqual([]);
  });

  it('goes once the move can go — after it, whatever the kinds’ order', () => {
    const { changes, ready, held } = plan(movedM1(newOpponent('New VC')));
    expect(keysOf(changes)).toEqual(['opponent:ox', 'opponent:o1', 'match:m1']);
    expect(held).toEqual([]);
    expect(keysOf(ready)).toEqual(['opponent:ox', 'match:m1', 'opponent:o1']);
    expect(ready[2].payload).toBeNull();
  });

  it('waits too when the server refused the match’s change', () => {
    const moved = movedM1(newOpponent('New VC'));
    const match = plan(moved).changes.filter((c) => c.key === 'match:m1');
    const { ready, held } = plan(moved, new Set([groupSignature(match)]));
    expect(reasons(held)).toEqual({ 'match:m1': 'refused', 'opponent:o1': 'parent' });
    expect(keysOf(ready)).toEqual(['opponent:ox']);
  });

  it('a season’s deletion waits for such a match as well, and for an opponent the server has', () => {
    // m2 (server: season s2, opponent o3) moves to o2 in s1; s2 goes with its opponent o3.
    const moved: TeamData = {
      ...data,
      seasons: data.seasons.filter((x) => x.id !== 's2'),
      opponents: data.opponents.filter((o) => o.id !== 'o3'),
      matches: data.matches.map((m) =>
        m.id === 'm2' ? { ...m, seasonId: 's1', opponentId: 'o2', opponent: LONG } : m,
      ),
    };
    const first = plan(moved);
    expect(reasons(first.held)).toEqual({
      'match:m2': 'invalid',
      'season:s2': 'parent',
      'opponent:o3': 'parent',
    });
    expect(first.ready).toEqual([]);

    // An opponent the server has can't be pushed as it is now: only the season's deletion waits
    // (an opponent's deletion takes matches along, and no match's change waits).
    const renamed: TeamData = {
      ...data,
      seasons: data.seasons.filter((x) => x.id !== 's2'),
      opponents: data.opponents
        .filter((o) => o.id !== 'o3' && o.id !== 'o1')
        .map((o) => (o.id === 'o2' ? { ...o, name: LONG } : o)),
      matches: data.matches.filter((m) => m.teamId !== 't1'),
    };
    const second = plan(renamed);
    expect(reasons(second.held)).toEqual({ 'opponent:o2': 'invalid', 'season:s2': 'parent' });
    expect(keysOf(second.ready).slice(-2)).toEqual(['opponent:o1', 'opponent:o3']);
  });

  it('a new match that waits holds no deletion: the server has no copy of it anywhere', () => {
    const fresh: TeamData = {
      ...data,
      opponents: data.opponents.filter((o) => o.id !== 'o2'),
      matches: [
        ...data.matches,
        { ...data.matches[1], id: 'mx', seasonId: 's1', opponentId: 'o1', opponent: LONG },
      ],
    };
    const { ready, held } = plan(fresh);
    expect(reasons(held)).toEqual({ 'match:mx': 'invalid', 'set:mx/1': 'parent' });
    expect(keysOf(ready)).toEqual(['opponent:o2']);
  });

  it('every other deletion keeps its place; seasons’ and opponents’ go last, seasons first', () => {
    const next: TeamData = {
      ...renameP2(data, 'Renamed'),
      seasons: data.seasons.filter((x) => x.id !== 's2'),
      opponents: data.opponents.filter((o) => o.id !== 'o3' && o.id !== 'o2'),
      matches: data.matches.filter((m) => m.id !== 'm2'),
    };
    const { changes, ready, held } = plan(next);
    expect(held).toEqual([]);
    expect(keysOf(changes)).toEqual([
      'season:s2',
      'opponent:o2',
      'opponent:o3',
      'player:p2',
      'match:m2',
      'set:m2/1',
    ]);
    expect(keysOf(ready)).toEqual([
      'player:p2',
      'match:m2',
      'set:m2/1',
      'season:s2',
      'opponent:o2',
      'opponent:o3',
    ]);
    // Planned again (as after a refusal in the middle of a push), the order stays.
    expect(sendableChanges(ready, team.base, 't1').ready).toEqual(ready);
  });
});

describe('sendableChanges: a text the database can’t store (review of the audit’s push PR)', () => {
  it('holds a record with half an emoji in a name as refused; whole emoji go', () => {
    const half = renameP2(goldenTeamData(), `Ann\ud83c`);
    const { ready, held } = sendableChanges(allChanges(half), {}, 't1');
    expect(held.map((h) => [h.change.key, h.reason])).toEqual([['player:p2', 'refused']]);
    expect(keysOf(ready)).not.toContain('player:p2');
    const whole = renameP2(goldenTeamData(), 'Ann 🏐');
    expect(sendableChanges(allChanges(whole), {}, 't1').held).toEqual([]);
  });

  it('holds a deletion under such an id too (it could never have been stored)', () => {
    const change: LocalChange = {
      key: 'player:p\udc00',
      kind: 'player',
      id: 'p\udc00',
      payload: null,
      hash: '',
      at: T1,
    };
    expect(sendableChanges([change], {}, 't1').held).toEqual([{ change, reason: 'refused' }]);
  });
});

describe('recordLabel', () => {
  const change = (kind: LocalChange['kind'], payload: LocalChange['payload']) => ({
    kind,
    payload,
  });

  it('names a record by its name fields', () => {
    expect(recordLabel(change('player', { firstName: ' Anna ', lastName: 'Meier' }))).toBe(
      'Anna Meier',
    );
    expect(recordLabel(change('player', { firstName: 'Anna', lastName: '' }))).toBe('Anna');
    expect(recordLabel(change('match', { opponent: 'TV Muster', date: '2026-11-26' }))).toBe(
      'TV Muster',
    );
    expect(recordLabel(change('season', { name: 'Winter Cup' }))).toBe('Winter Cup');
    expect(recordLabel(change('team', { name: 'U18' }))).toBe('U18');
  });

  it('is empty for a record without a name and for a deletion', () => {
    expect(recordLabel(change('set', { setNumber: 1 }))).toBe('');
    expect(recordLabel(change('starters', { name: 7 }))).toBe('');
    expect(recordLabel(change('player', null))).toBe('');
  });

  it('cuts a long name (by characters, not half emoji)', () => {
    expect(recordLabel(change('team', { name: 'x'.repeat(41) }))).toBe(`${'x'.repeat(40)}…`);
    expect(recordLabel(change('team', { name: 'x'.repeat(40) }))).toBe('x'.repeat(40));
    expect(recordLabel(change('team', { name: '🏐'.repeat(5) }), 3)).toBe('🏐🏐🏐…');
  });
});
