/**
 * v10 sync engine: when it syncs (start, data changes, the interval, following a live match,
 * the back-off when offline), that a local-only device never touches the network, sign-out when
 * the account link goes, and live match holds.
 */
import { AppState, type AppStateStatus } from 'react-native';

import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { useAppStore, useSyncRuntime } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { holdMatch, releaseMatch } from '../holdCommands';
import { downloadTeams, uploadTeams } from '../teamCommands';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), 't1');
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

const count = (cloud: FakeCloud, name: string) => cloud.calls.filter((c) => c === name).length;

const rename = (firstName: string) =>
  useAppStore.setState((s) => ({
    players: s.players.map((p) => (p.id === 'p2' ? { ...p, firstName } : p)),
  }));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a local-only device', () => {
  it('makes no network call at all: not on start, not on edits, not over time', async () => {
    const cloud = new FakeCloud();
    const d = new TestDevice(cloud, 'dev-a', t1());
    await d.act(async (engine) => {
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(5000);
      rename('Local edit');
      await jest.advanceTimersByTimeAsync(10 * 60_000);
      await engine.syncNow();
      engine.followMatch('m1');
      await jest.advanceTimersByTimeAsync(60_000);
      stop();
      expect(useSyncRuntime.getState().status.phase).toBe('off');
    });
    expect(cloud.calls).toEqual([]);
  });
});

describe('a signed-in device with a shared team', () => {
  async function started() {
    const cloud = new FakeCloud();
    const d = new TestDevice(cloud, 'dev-a', t1());
    await d.signIn('anna@example.test');
    await d.act(async (engine) => {
      await uploadTeams(engine, ['t1']);
      await engine.runCycle();
    });
    return { cloud, d };
  }

  it('syncs after start (deferred), after a change (3 s), every 60 s and every 15 s when following', async () => {
    const { cloud, d } = await started();
    await d.act(async (engine) => {
      const pulls = () => count(cloud, 'pullChanges');
      const before = pulls();
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(100);
      expect(pulls()).toBe(before); // not at once: the first cycle waits for an idle screen
      await jest.advanceTimersByTimeAsync(2000);
      expect(pulls()).toBe(before + 1);

      cloud.clock.tick(1000);
      rename('Changed');
      await jest.advanceTimersByTimeAsync(2900);
      expect(pulls()).toBe(before + 1);
      await jest.advanceTimersByTimeAsync(200);
      expect(pulls()).toBe(before + 2);
      expect(cloud.record('t1', 'player', 'p2')?.payload).toMatchObject({ firstName: 'Changed' });

      await jest.advanceTimersByTimeAsync(60_000);
      expect(pulls()).toBe(before + 3);

      engine.followMatch('m1');
      await jest.advanceTimersByTimeAsync(0);
      expect(pulls()).toBe(before + 4); // at once
      await jest.advanceTimersByTimeAsync(30_000);
      expect(pulls()).toBe(before + 6);
      engine.followMatch(null);
      await jest.advanceTimersByTimeAsync(30_000);
      expect(pulls()).toBe(before + 6);
      stop();
    });
  });

  it('offline: retries after 10 s, 30 s, … (the interval waits); "Sync now" retries at once', async () => {
    const { cloud, d } = await started();
    await d.act(async (engine) => {
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(2000);
      cloud.fail = 'offline';
      const tries = () => count(cloud, 'memberships');
      await engine.syncNow();
      const first = tries();
      expect(useSyncRuntime.getState().status.phase).toBe('offline');
      await jest.advanceTimersByTimeAsync(10_000);
      expect(tries()).toBe(first + 1);
      await jest.advanceTimersByTimeAsync(29_000);
      expect(tries()).toBe(first + 1);
      await jest.advanceTimersByTimeAsync(1000);
      expect(tries()).toBe(first + 2);
      cloud.fail = null;
      await engine.syncNow();
      expect(useSyncRuntime.getState().status.phase).toBe('synced');
      stop();
    });
  });

  it('the foreground catches up at once; going to the background pushes', async () => {
    const { cloud, d } = await started();
    const listeners: ((s: AppStateStatus) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      listeners.push(fn as (s: AppStateStatus) => void);
      return { remove: jest.fn() };
    });
    await d.act(async (engine) => {
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(2000);
      cloud.clock.tick(1000);
      rename('Before background');
      for (const fn of listeners) fn('background');
      await jest.advanceTimersByTimeAsync(0);
      expect(cloud.record('t1', 'player', 'p2')?.payload).toMatchObject({
        firstName: 'Before background',
      });
      await jest.advanceTimersByTimeAsync(5000);
      const inBackground = count(cloud, 'pullChanges');
      await jest.advanceTimersByTimeAsync(120_000);
      expect(count(cloud, 'pullChanges')).toBe(inBackground); // no interval in the background
      for (const fn of listeners) fn('active');
      await jest.advanceTimersByTimeAsync(0);
      expect(count(cloud, 'pullChanges')).toBe(inBackground + 1);
      stop();
    });
    spy.mockRestore();
  });

  it('signs out (this device only) when the account link is cleared, e.g. Delete all data', async () => {
    const { cloud, d } = await started();
    await d.act(async (engine) => {
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(2000);
      useAppStore.getState().resetAll();
      await jest.advanceTimersByTimeAsync(0);
      expect(cloud.calls).toContain('signOut');
      expect(useSyncRuntime.getState().session).toBeNull();
      expect(useSyncRuntime.getState().status.phase).toBe('off');
      stop();
    });
  });

  it('a session the server ended shows "sign in again" (signedOut)', async () => {
    const { d } = await started();
    await d.act(async (engine) => {
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(2000);
      d.backend.revokeSession();
      expect(useSyncRuntime.getState().status).toMatchObject({
        phase: 'error',
        error: 'signedOut',
      });
      expect(useSyncRuntime.getState().session).toBeNull();
      stop();
    });
  });

  it('restores the stored session on start', async () => {
    const { d } = await started();
    d.runtime = { ...d.runtime, session: null };
    await d.act(async (engine) => {
      engine.setSession(null);
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(useSyncRuntime.getState().session?.email).toBe('anna@example.test');
      stop();
    });
  });

  it('says "restoring" from start until the stored session is read (offline: until online)', async () => {
    const { d } = await started();
    d.runtime = { ...d.runtime, session: null };
    const restore = d.backend.getSession.bind(d.backend);
    d.backend.getSession = async () => {
      throw new TypeError('Network request failed');
    };
    await d.act(async (engine) => {
      engine.setSession(null);
      const stop = engine.start();
      expect(useSyncRuntime.getState().restoring).toBe(true);
      await jest.advanceTimersByTimeAsync(2000);
      expect(useSyncRuntime.getState()).toMatchObject({ restoring: true, session: null });
      d.backend.getSession = restore;
      await engine.syncNow();
      expect(useSyncRuntime.getState().restoring).toBe(false);
      expect(useSyncRuntime.getState().session?.email).toBe('anna@example.test');
      stop();
    });
  });

  it('restoring ends at once without a stored session, and when the engine stops', async () => {
    const cloud = new FakeCloud();
    const d = new TestDevice(cloud, 'dev-a', t1());
    await d.act(async (engine) => {
      engine.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(useSyncRuntime.getState().restoring).toBe(false);
      engine.stop();
    });
    const e = new TestDevice(cloud, 'dev-b', t1());
    await e.act(async (engine) => {
      useAppStore
        .getState()
        .setSyncAccount({ userId: 'x', email: 'x@example.test', profileId: 'pr1' });
      engine.start();
      expect(useSyncRuntime.getState().restoring).toBe(true);
      engine.stop();
      expect(useSyncRuntime.getState().restoring).toBe(false);
    });
  });

  it('a match followed before the session is restored is polled every 15 s once it is', async () => {
    const { cloud, d } = await started();
    d.runtime = { ...d.runtime, session: null };
    await d.act(async (engine) => {
      engine.setSession(null);
      engine.followMatch('m1'); // the live screen mounts before SyncHost starts the engine
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(2000);
      const pulls = count(cloud, 'pullChanges');
      await jest.advanceTimersByTimeAsync(30_000);
      expect(count(cloud, 'pullChanges')).toBe(pulls + 2);
      stop();
    });
  });
});

describe('live match holds', () => {
  it('a granted hold shows at once; another device is refused until it takes over', async () => {
    jest.useRealTimers();
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1());
    const b = new TestDevice(cloud, 'dev-b');
    await a.signIn('anna@example.test');
    await b.signIn('anna@example.test');
    await a.act(async (e) => {
      await uploadTeams(e, ['t1']);
      await e.runCycle();
    });
    await b.act((e) => downloadTeams(e, ['t1']));

    expect(await a.act((e) => holdMatch(e, 't1', 'm1'))).toEqual({
      ok: true,
      value: { granted: true },
    });
    expect(a.runtime.holds.m1).toMatchObject({ deviceId: 'dev-a', holderName: 'Coach' });

    expect(await b.act((e) => holdMatch(e, 't1', 'm1'))).toEqual({
      ok: true,
      value: { granted: false, holder: 'Coach' },
    });
    expect(b.runtime.holds.m1).toMatchObject({ deviceId: '', holderName: 'Coach' });

    expect(await b.act((e) => holdMatch(e, 't1', 'm1', true))).toEqual({
      ok: true,
      value: { granted: true },
    });
    expect(b.runtime.holds.m1).toMatchObject({ deviceId: 'dev-b' });
    await a.cycle();
    expect(a.runtime.holds.m1).toMatchObject({ deviceId: 'dev-b' });

    await b.act((e) => releaseMatch(e, 't1', 'm1'));
    expect(b.runtime.holds.m1).toBeUndefined();
    expect(cloud.holds.size).toBe(0);
  });

  it('signed out: no call, notSignedIn; release never fails', async () => {
    jest.useRealTimers();
    const cloud = new FakeCloud();
    const d = new TestDevice(cloud, 'dev-a', t1());
    expect(await d.act((e) => holdMatch(e, 't1', 'm1'))).toEqual({
      ok: false,
      error: 'notSignedIn',
    });
    await expect(d.act((e) => releaseMatch(e, 't1', 'm1'))).resolves.toBeUndefined();
    expect(cloud.calls).toEqual([]);
  });
});
