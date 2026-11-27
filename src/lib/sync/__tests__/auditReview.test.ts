/**
 * v10 audit: cases the independent review of the fixes found (docs/AUDIT_V10.md, "After the
 * fixes"). Each failed on the first version of the fix it belongs to.
 */
import { importWithSharedTeams, sharedTeamsOf } from '@/domain/syncImport';
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import type { Player } from '@/domain/types';
import { transferSnapshot, transferSnapshotNow, useAppStore, useSyncRuntime } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { createInvite, setMemberRole } from '../memberCommands';
import { downloadTeams, joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const OTHER = 'data:image/jpeg;base64,/9j/AAAA';

function t1(photos = false): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  if (photos) return { ...slice, teams: [{ ...slice.team, profileId: PROFILE.id }] };
  return {
    ...slice,
    teams: [{ ...slice.team, profileId: PROFILE.id, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

/** Anna (manager, device A) shares t1; Ben joins as a player on device B (with `bData`). */
async function withViewer(bData: Partial<TeamData> = {}) {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b', bData);
  await a.signIn('anna@example.test');
  await b.signIn('ben@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  const invite = await a.act((e) => createInvite(e, T1, 'player', 7));
  if (!invite.ok) throw new Error('no invite');
  const joined = await b.act((e) => joinTeam(e, invite.value.code));
  // An older copy on B is only replaced once the user has agreed (v10 audit M7).
  if (joined.ok && joined.value.localCopy) await b.act((e) => downloadTeams(e, [T1], [T1]));
  await b.cycle();
  return { cloud, a, b };
}

const promote = (cloud: FakeCloud, a: TestDevice) =>
  a.act((e) => setMemberRole(e, T1, cloud.userId('ben@example.test'), 'manager'));

/** Records what device `d` pushes from now on. */
function watchPushes(d: TestDevice): unknown[] {
  const pushed: unknown[] = [];
  const push = d.backend.pushRecords.bind(d.backend);
  d.backend.pushRecords = async (teamId, deviceId, items) => {
    pushed.push(...items);
    return push(teamId, deviceId, items);
  };
  return pushed;
}

describe('promotion (H8)', () => {
  it('completes although one row’s id belongs to another local team, without pulling from 0 forever', async () => {
    const { cloud, a, b } = await withViewer();
    const p2 = a.data.players.find((p) => p.id === 'p2') as Player;
    const clash: Player = { ...p2, id: 'px', teamId: 'local', firstName: 'Local' };
    await b.edit((s) => ({
      teams: [
        ...s.teams,
        { id: 'local', profileId: PROFILE.id, name: 'Local', createdAt: '2026-01-01' },
      ],
      players: [...s.players, clash],
    }));
    await a.edit((s) => ({
      players: [...s.players, { ...clash, teamId: T1, firstName: 'Shared' }],
    }));
    await a.cycle();
    cloud.clock.tick(60_000);
    await b.cycle();
    await promote(cloud, a);
    const afters: number[] = [];
    const pull = b.backend.pullChanges.bind(b.backend);
    b.backend.pullChanges = async (teamId, after, limit) => {
      afters.push(after);
      return pull(teamId, after, limit);
    };
    const pushed = watchPushes(b);
    for (let i = 0; i < 4; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    expect(b.data.sync.teams[T1].role).toBe('manager');
    expect(afters.filter((after) => after === 0)).toHaveLength(1); // the one reset pull
    // The row it can't apply is neither pushed back nor deleted.
    expect(pushed).toEqual([]);
    expect(cloud.record(T1, 'player', 'px')?.deleted).toBe(false);
    expect(b.data.players.find((p) => p.id === 'px')?.firstName).toBe('Local');
  });

  it('a viewer that joined over an old local copy pushes nothing for records the cloud never had', async () => {
    const old = t1();
    const extra = { ...old.players[0], id: 'p-old', number: 97, firstName: 'OldOnly' };
    const { cloud, a, b } = await withViewer({ ...old, players: [...old.players, extra] });
    expect(b.data.players.some((p) => p.id === 'p-old')).toBe(false);
    cloud.clock.tick(60_000);
    await promote(cloud, a);
    const pushed = watchPushes(b);
    await b.cycle();
    await b.cycle();
    expect(b.data.sync.teams[T1].role).toBe('manager');
    expect(pushed).toEqual([]);
    expect(cloud.record(T1, 'player', 'p-old')).toBeUndefined();
  });

  it('a record this device lacks and whose cloud row it can’t read isn’t deleted for everyone', async () => {
    const { cloud, a, b } = await withViewer();
    const lone = { ...a.data.players[0], id: 'p-lone', number: 96, firstName: 'Lone' };
    await a.edit((s) => ({ players: [...s.players, lone] }));
    await a.cycle();
    cloud.clock.tick(60_000);
    await b.cycle();
    // The view-only copy loses the player; another manager's app saves it with a first name
    // longer than this app accepts.
    await b.edit((s) => ({ players: s.players.filter((p) => p.id !== 'p-lone') }));
    cloud.clock.tick(60_000);
    const other = cloud.device();
    other.signInAs('anna@example.test');
    const payload = {
      ...(cloud.record(T1, 'player', 'p-lone')?.payload ?? {}),
      firstName: 'x'.repeat(300),
    };
    const at = new Date(cloud.clock.ms).toISOString();
    await other.pushRecords(T1, 'dev-x', [{ kind: 'player', id: 'p-lone', at, payload }]);
    cloud.clock.tick(60_000);
    await promote(cloud, a);
    await b.cycle();
    await b.cycle();
    expect(b.data.sync.teams[T1].role).toBe('manager');
    expect(cloud.record(T1, 'player', 'p-lone')?.deleted).toBe(false);
  });
});

describe('photos of a refused push (H3)', () => {
  it('a newer row that loses against a still newer local change doesn’t get its photo removed', async () => {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1(true));
    a.photos = { ph2: PHOTO, ph3: PHOTO };
    const b = new TestDevice(cloud, 'dev-b');
    await a.signIn('anna@example.test');
    await b.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    await b.act((e) => downloadTeams(e, [T1]));
    cloud.clock.tick(60_000);
    await b.cycle();

    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'First edit' } : p)),
    }));
    cloud.clock.tick(5000);
    const other = cloud.device();
    other.signInAs('anna@example.test');
    const push = b.backend.pushRecords.bind(b.backend);
    let first = true;
    b.backend.pushRecords = async (teamId, deviceId, items) => {
      if (!first) return push(teamId, deviceId, items);
      first = false;
      // Another manager device saves p1 with a new photo, a little later than B's first edit…
      const payload = { ...(cloud.record(T1, 'player', 'p1')?.payload ?? {}), photoId: 'ph-new' };
      await other.uploadPhoto(T1, 'ph-new', OTHER);
      const at = new Date(cloud.clock.ms + 1000).toISOString();
      await other.pushRecords(T1, 'dev-x', [{ kind: 'player', id: 'p1', at, payload }]);
      const results = await push(teamId, deviceId, items);
      // …and while B's push was on its way, the user changed p1 again on B.
      cloud.clock.tick(4000);
      useAppStore.setState((s) => ({
        players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Second edit' } : p)),
      }));
      return results;
    };
    await b.act((e) => e.runCycle()); // exactly one cycle
    // The server's row still points at the new photo (B's second edit isn't pushed yet): the
    // photo must still be in the cloud folder.
    expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({ photoId: 'ph-new' });
    expect(cloud.photos.has(`${T1}/ph-new`)).toBe(true);
  });
});

describe('links without a team on the device (C1)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a link that hasn’t pulled yet doesn’t adopt a team an import brings under its id', async () => {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1());
    const b = new TestDevice(cloud, 'dev-b');
    await a.signIn('anna@example.test');
    await b.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    const backup = await a.act(() => transferSnapshot());
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Newer' } : p)),
    }));
    await a.cycle();

    // B taps Download while the connection drops: linked, nothing pulled, no team yet.
    cloud.clock.tick(60_000);
    const pull = b.backend.pullChanges.bind(b.backend);
    b.backend.pullChanges = async () => {
      throw new TypeError('Network request failed');
    };
    await b.act((e) => downloadTeams(e, [T1]));
    expect(b.data.teams).toEqual([]);
    expect(b.data.sync.teams[T1]).toMatchObject({ cursor: 0, base: {} });

    // Still offline, B restores the backup, which contains t1.
    await b.act(() => {
      const store = useAppStore.getState();
      const shared = sharedTeamsOf(store.sync.teams, store.teams);
      const result = importWithSharedTeams(transferSnapshotNow(), backup, 'replace', shared);
      if (!result.ok) throw new Error('import failed');
      store.replaceAll(result.data);
      useAppStore.getState().selectProfile(PROFILE.id);
    });
    expect(b.data.teams.map((t) => t.id)).toEqual([T1]);
    expect(b.data.sync.teams).toEqual({}); // a local team: the link didn't adopt it

    b.backend.pullChanges = pull;
    cloud.clock.tick(60_000);
    await b.act((e) => e.syncNow());
    await a.cycle();
    expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({ firstName: 'Newer' });
    expect(a.data.players.find((p) => p.id === 'p1')?.firstName).toBe('Newer');
  });

  it('a link left by 10.0.0 is dropped when the app starts: no network call, no cycle needed', async () => {
    const cloud = new FakeCloud();
    const d = new TestDevice(cloud, 'dev-a', t1());
    await d.signIn('anna@example.test');
    await d.act((e) => uploadTeams(e, [T1]));
    await d.cycle();
    await d.act(async (e) => {
      await e.signOut();
      const link = useAppStore.getState().sync.teams[T1];
      useAppStore.getState().deleteProfile(PROFILE.id);
      useAppStore.setState((s) => ({ sync: { ...s.sync, teams: { [T1]: link } } }));
    });
    expect(Object.keys(d.data.sync.teams)).toEqual([T1]);
    // A new engine on the stored data is an app restart.
    const restarted = new TestDevice(cloud, 'dev-a2');
    restarted.data = d.data;
    const mark = cloud.calls.length;
    await restarted.act(async (engine) => {
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(useAppStore.getState().sync.teams).toEqual({});
      stop();
    });
    expect(cloud.calls.slice(mark)).toEqual([]);
  });

  it('a local-only device makes no store write and no call at start', async () => {
    const cloud = new FakeCloud();
    const d = new TestDevice(cloud, 'dev-a', t1());
    let writes = 0;
    await d.act(async (engine) => {
      const unsubscribe = useAppStore.subscribe(() => {
        writes += 1;
      });
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(10 * 60_000);
      stop();
      unsubscribe();
    });
    expect(cloud.calls).toEqual([]);
    expect(writes).toBe(0);
  });

  it('a team unlinked by the store takes its run-time state with it', async () => {
    const cloud = new FakeCloud();
    const d = new TestDevice(cloud, 'dev-a', t1());
    await d.signIn('anna@example.test');
    await d.act((e) => uploadTeams(e, [T1]));
    await d.cycle();
    await d.act(async (engine) => {
      const stop = engine.start(); // subscribes to the store once it has booted, as in the app
      await jest.advanceTimersByTimeAsync(0);
      engine.resetPending.add(T1);
      engine.pendingPhotos.set(T1, new Set(['ph-x']));
      useSyncRuntime.setState({
        holds: {
          m1: {
            matchId: 'm1',
            teamId: T1,
            deviceId: 'dev-z',
            userId: 'u',
            holderName: 'Zoe',
            heldUntil: '2099-01-01T00:00:00.000Z',
          },
        },
      });
      useAppStore.getState().deleteTeam(T1);
      expect(useAppStore.getState().sync.teams).toEqual({});
      expect(engine.resetPending.has(T1)).toBe(false);
      expect(engine.pendingPhotos.has(T1)).toBe(false);
      expect(useSyncRuntime.getState().holds).toEqual({});
      stop();
    });
  });
});
