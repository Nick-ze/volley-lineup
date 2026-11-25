import { goldenTeamData, linkedTeam, sliceOf } from '@/test-utils/syncFixtures';

import {
  detectChanges,
  edgePhotoIds,
  pendingCount,
  pushBatches,
  PUSH_LIMITS,
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
