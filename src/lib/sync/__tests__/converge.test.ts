/**
 * v10 sync engine: two devices of one team converge through the (fake) server — edits on both
 * sides, delete vs edit, live scoring, offline and a paused project.
 */
import { sliceToRecords, teamSlice, type TeamData } from '@/domain/syncRecords';
import type { Match, PointEvent } from '@/domain/types';
import { useAppStore, useSyncRuntime } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { downloadTeams, uploadTeams } from '../teamCommands';

const T1 = 't1';

/** The golden data's team t1 (with its photos, which the golden players / team refer to). */
function golden(): { data: TeamData; photos: Record<string, string> } {
  const all = goldenTeamData();
  const slice = teamSlice(all, T1);
  if (!slice) throw new Error('no t1');
  const data = { ...slice, teams: [slice.team] };
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  return { data, photos: { ph2: photo, ph3: photo } };
}

/** Device A uploads t1, device B (same account) downloads it. */
async function twoDevices(cloud = new FakeCloud()) {
  const { data, photos } = golden();
  const a = new TestDevice(cloud, 'dev-a', data);
  a.photos = photos;
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('anna@example.test');
  const up = await a.act((engine) => uploadTeams(engine, [T1]));
  expect(up).toEqual({ ok: true, value: [{ teamId: T1, result: 'created' }] });
  await a.cycle();
  const down = await b.act((engine) => downloadTeams(engine, [T1]));
  expect(down).toEqual({ ok: true, value: [] });
  return { cloud, a, b };
}

const sliceOf = (d: TestDevice) => teamSlice(d.data, T1);
/** The team as records (what both devices must agree on; order and device-only fields aside). */
function records(d: TestDevice): Record<string, unknown> {
  const slice = sliceOf(d);
  if (!slice) return {};
  return Object.fromEntries([...sliceToRecords(slice)].sort(([x], [y]) => x.localeCompare(y)));
}
const playerName = (d: TestDevice, id: string) =>
  d.data.players.find((p) => p.id === id)?.firstName;

function renamePlayer(d: TestDevice, id: string, firstName: string) {
  return d.edit((s) => ({
    players: s.players.map((p) => (p.id === id ? { ...p, firstName } : p)),
  }));
}

describe('two devices converge', () => {
  it('downloads the uploaded team with everything and its photos', async () => {
    const { a, b } = await twoDevices();
    expect(records(b)).toEqual(records(a));
    expect(Object.keys(records(a)).length).toBeGreaterThan(10);
    expect(b.photos).toEqual(a.photos);
    expect(b.data.sync.teams[T1]).toMatchObject({ role: 'manager', edits: {} });
    expect(a.data.sync.teams[T1].edits).toEqual({});
    expect(a.runtime.status.phase).toBe('synced');
    expect(a.runtime.status.pending).toBe(0);
  });

  it('edits on both sides reach the other device; the later save of one record wins', async () => {
    const { cloud, a, b } = await twoDevices();
    await renamePlayer(a, 'p1', 'Anna A');
    await renamePlayer(b, 'p2', 'Bea B');
    cloud.clock.tick(1000);
    await renamePlayer(a, 'p3', 'Early');
    await a.act((e) => e.runCycle()); // a notes its changes at this time
    cloud.clock.tick(1000);
    await renamePlayer(b, 'p3', 'Later');
    await b.cycle();
    await a.cycle();
    await b.cycle();
    expect(playerName(a, 'p1')).toBe('Anna A');
    expect(playerName(b, 'p1')).toBe('Anna A');
    expect(playerName(a, 'p2')).toBe('Bea B');
    expect(playerName(a, 'p3')).toBe('Later');
    expect(playerName(b, 'p3')).toBe('Later');
    expect(records(a)).toEqual(records(b));
  });

  it('delete vs a later edit: the edit wins and the record comes back', async () => {
    const { cloud, a, b } = await twoDevices();
    const preset = a.data.presets.find((p) => p.kind === 'preset');
    if (!preset) throw new Error('no preset');
    await a.edit((s) => ({ presets: s.presets.filter((p) => p.id !== preset.id) }));
    await a.cycle();
    cloud.clock.tick(5000);
    await b.edit((s) => ({
      presets: s.presets.map((p) => (p.id === preset.id ? { ...p, name: 'Kept' } : p)),
    }));
    await b.cycle();
    await a.cycle();
    expect(a.data.presets.find((p) => p.id === preset.id)?.name).toBe('Kept');
    expect(records(a)).toEqual(records(b));
  });

  it('live scoring on one device shows on the other (a whole set travels)', async () => {
    const { cloud, a, b } = await twoDevices();
    const match = a.data.matches.find((m) => m.id === 'm2') as Match;
    const point = (winner: 'us' | 'them'): PointEvent => ({ type: 'point', winner });
    for (let i = 0; i < 3; i += 1) {
      await a.edit((s) => ({
        matches: s.matches.map((m) =>
          m.id === match.id
            ? {
                ...m,
                sets: m.sets.map((set, n) =>
                  n === 0 ? { ...set, events: [...(set.events ?? []), point('us')] } : set,
                ),
              }
            : m,
        ),
      }));
      cloud.clock.tick(2000);
      await a.cycle();
      await b.cycle();
      const events = (d: TestDevice) =>
        d.data.matches.find((m) => m.id === match.id)?.sets[0].events?.length;
      expect(events(b)).toBe(events(a));
    }
  });

  it('offline: changes wait (pending), nothing is lost, and they go out when back', async () => {
    const { cloud, a, b } = await twoDevices();
    cloud.clock.tick(1000);
    await renamePlayer(a, 'p1', 'Offline edit');
    cloud.fail = 'offline';
    const before = a.data.players;
    await a.cycle();
    expect(a.runtime.status).toMatchObject({ phase: 'offline', pending: 1 });
    expect(a.runtime.status.retryAt).not.toBeNull();
    expect(a.data.players).toBe(before);
    cloud.fail = null;
    await a.act((e) => e.syncNow());
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 0, retryAt: null });
    await b.cycle();
    expect(playerName(b, 'p1')).toBe('Offline edit');
  });

  it('a paused project (HTTP 5xx) counts as offline: no data change, no error thrown', async () => {
    const { cloud, b } = await twoDevices();
    cloud.fail = 'paused';
    const before = b.data;
    await expect(b.cycle()).resolves.toBeUndefined();
    expect(b.runtime.status.phase).toBe('offline');
    expect(b.runtime.status.error).toBeNull();
    expect(b.data.players).toBe(before.players);
    expect(b.data.sync).toBe(before.sync);
  });
});

describe('the store after a cycle', () => {
  it('writes nothing when nothing changed (no extra persisted write)', async () => {
    const { a } = await twoDevices();
    await a.act(async (engine) => {
      const spy = jest.fn();
      const stop = useAppStore.subscribe(spy);
      await engine.runCycle();
      stop();
      expect(spy).not.toHaveBeenCalled();
      expect(useSyncRuntime.getState().status.phase).toBe('synced');
    });
  });
});
