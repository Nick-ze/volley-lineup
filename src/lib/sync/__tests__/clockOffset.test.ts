/**
 * v10 audit (docs/AUDIT_V10.md M2): the most recent save wins, and each device used its own
 * clock to say when a change was made. A device whose clock runs ahead won every conflict it had
 * an unsynced change for — also against saves that really were later — and a device whose clock
 * runs behind lost them. Now a pull tells the device the server's time, and changes are noted in
 * that time (`serverTime.ts`).
 *
 * Where the server's time isn't known — a device that has never pulled, after an app start,
 * after the clock was changed or the device slept — the device's clock is used exactly as
 * before; nothing noted in an earlier app run is ever changed.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import type { Clock } from '../core';
import { createEngine } from '../engine';
import { BackendError } from '../errors';
import { createInvite } from '../memberCommands';
import { MAX_CLOCK_DRIFT_MS } from '../serverTime';
import { joinTeam, uploadTeams } from '../teamCommands';
import { noteAll } from '../teamSync';

const T1 = 't1';
const MIN = 60_000;

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, profileId: PROFILE.id, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

/** Two managers of t1; A's clock is off by `skewMs` (ahead when positive). Both in sync. */
async function twoManagers(skewMs: number) {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1(), { skewMs });
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('ben@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  const invite = await a.act((e) => createInvite(e, T1, 'manager', 7));
  if (!invite.ok) throw new Error('no invite');
  await b.act((e) => joinTeam(e, invite.value.code));
  cloud.clock.tick(MIN);
  await a.cycle();
  await b.cycle();
  return { cloud, a, b };
}

const rename = (d: TestDevice, id: string, firstName: string) =>
  d.edit((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, firstName } : p)) }));
const name = (d: TestDevice, id: string) => d.data.players.find((p) => p.id === id)?.firstName;
const cloudName = (cloud: FakeCloud, id: string) =>
  (cloud.record(T1, 'player', id)?.payload as { firstName?: string } | undefined)?.firstName;
const editTime = (d: TestDevice, id: string) =>
  Date.parse(d.data.sync.teams[T1].edits[`player:${id}`]?.at ?? '');
/** How far this device's clock is from the server's, as last measured (undefined: unknown). */
const offsetOf = (d: TestDevice): number | undefined => d.engine.serverTime?.offset;
/** Notes this device's changes now, as the engine does a moment after a change. */
const note = (d: TestDevice) => d.act((e) => noteAll(e));

describe('conflicts between devices whose clocks differ (audit M2)', () => {
  it('a device whose clock runs ahead no longer beats a save that really was later', async () => {
    const { cloud, a, b } = await twoManagers(10 * MIN);
    // A changes p1 first; B changes it a minute later and syncs; then A syncs.
    await rename(a, 'p1', 'A, earlier');
    await note(a);
    cloud.clock.tick(MIN);
    await rename(b, 'p1', 'B, later');
    await b.cycle();
    cloud.clock.tick(MIN);
    await a.cycle();
    await b.cycle();
    // Before: A's change, noted ten minutes "later" by its own clock, won on every device.
    expect(cloudName(cloud, 'p1')).toBe('B, later');
    expect(name(a, 'p1')).toBe('B, later');
    expect(name(b, 'p1')).toBe('B, later');
    expect(a.runtime.status.pending).toBe(0);
  });

  it('a device whose clock runs behind no longer loses with the later save', async () => {
    const { cloud, a, b } = await twoManagers(-10 * MIN);
    await rename(b, 'p1', 'B, earlier');
    await b.cycle();
    cloud.clock.tick(MIN);
    await rename(a, 'p1', 'A, later');
    await note(a);
    cloud.clock.tick(MIN);
    await a.cycle();
    await b.cycle();
    // Before: A's later change counted as ten minutes old and gave way to B's.
    expect(cloudName(cloud, 'p1')).toBe('A, later');
    expect(name(a, 'p1')).toBe('A, later');
    expect(name(b, 'p1')).toBe('A, later');
  });

  it('with a right clock nothing changes: the later of two saves wins', async () => {
    const { cloud, a, b } = await twoManagers(0);
    await rename(a, 'p1', 'A, earlier');
    await note(a);
    cloud.clock.tick(MIN);
    await rename(b, 'p1', 'B, later');
    await b.cycle();
    await rename(a, 'p2', 'A, later');
    await note(a);
    cloud.clock.tick(MIN);
    await a.cycle();
    await b.cycle();
    expect(name(a, 'p1')).toBe('B, later');
    expect(name(b, 'p2')).toBe('A, later');
  });

  it('notes a change in the server’s time, also offline, once a pull has told it', async () => {
    const { cloud, a } = await twoManagers(10 * MIN);
    cloud.fail = 'offline';
    cloud.clock.tick(5 * MIN);
    await rename(a, 'p1', 'Offline');
    await note(a);
    expect(editTime(a, 'p1')).toBe(cloud.clock.ms); // the server's time, not ten minutes on
  });

  it('a fast clock’s saves are no longer "in the future": its next change isn’t held up', async () => {
    const { cloud, a, b } = await twoManagers(10 * MIN);
    // Each change goes out with the cycle after it — none is refused once as "older than this
    // device's own last save" (what happens when a save carries a time ahead of the server's).
    for (const first of ['One', 'Two', 'Three']) {
      cloud.clock.tick(2000);
      await rename(a, 'p1', first);
      await a.cycle();
      expect(cloudName(cloud, 'p1')).toBe(first);
      expect(cloud.record(T1, 'player', 'p1')?.at).toBeLessThanOrEqual(cloud.clock.ms);
    }
    await b.cycle();
    expect(name(b, 'p1')).toBe('Three');
  });
});

describe('where the server’s time isn’t known, the device’s clock is used as before', () => {
  it('a device that has never pulled: its first changes are noted with its own clock', async () => {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1(), { skewMs: 10 * MIN });
    await a.signIn('anna@example.test');
    cloud.fail = 'offline';
    // Linked by hand (an upload needs the server): a team shared in an earlier app run.
    await a.edit((s) => ({
      sync: {
        ...s.sync,
        teams: {
          [T1]: { userId: 'user-1', role: 'manager', cursor: 0, base: {}, edits: {}, photos: [] },
        },
      },
    }));
    await note(a);
    expect(a.engine.serverTime).toBeNull();
    expect(editTime(a, 'p1')).toBe(cloud.clock.ms + 10 * MIN);
  });

  it('after an app start, offline: the device’s clock; times of the earlier run stay', async () => {
    const { cloud, a } = await twoManagers(10 * MIN);
    cloud.fail = 'offline';
    await rename(a, 'p1', 'Before the restart');
    await note(a);
    const before = editTime(a, 'p1');
    expect(before).toBe(cloud.clock.ms); // server time (measured in this run)
    // The app is closed and opened again without a connection: a new engine on the same data.
    cloud.clock.tick(MIN);
    const restarted = createEngine(a.backend, { now: () => cloud.clock.ms + 10 * MIN });
    await a.act(async () => {
      restarted.setSession(a.backend.session);
      await rename(a, 'p2', 'After the restart');
      noteAll(restarted);
      await restarted.runCycle(); // offline
    });
    expect(restarted.serverTime).toBeNull();
    expect(editTime(a, 'p2')).toBe(cloud.clock.ms + 10 * MIN); // the device's clock, as before
    expect(editTime(a, 'p1')).toBe(before); // untouched
    // Online again in that run: what this run noted is converted, the earlier run's time stays.
    cloud.fail = null;
    cloud.clock.tick(MIN);
    await a.act(() => restarted.syncNow());
    expect(cloudName(cloud, 'p1')).toBe('Before the restart');
    expect(cloudName(cloud, 'p2')).toBe('After the restart');
    expect(cloud.record(T1, 'player', 'p1')?.at).toBe(before);
    expect(cloud.record(T1, 'player', 'p2')?.at).toBe(cloud.clock.ms - MIN);
    expect(a.data.sync.teams[T1].edits).toEqual({});
  });

  it('changes made offline since the app started are converted when the connection is back', async () => {
    const { cloud, a, b } = await twoManagers(10 * MIN);
    // A new app run that starts offline; A changes p1, then B (online) changes it a minute later.
    a.engine.serverTime = null;
    a.engine.deviceStamps.clear();
    cloud.fail = 'offline';
    await rename(a, 'p1', 'A, earlier, offline');
    await a.cycle();
    expect(editTime(a, 'p1')).toBe(cloud.clock.ms + 10 * MIN);
    cloud.fail = null;
    cloud.clock.tick(MIN);
    await rename(b, 'p1', 'B, later');
    await b.cycle();
    cloud.clock.tick(MIN);
    await a.act((e) => e.syncNow());
    await b.cycle();
    expect(name(a, 'p1')).toBe('B, later');
    expect(cloudName(cloud, 'p1')).toBe('B, later');
  });
});

describe('a measurement that can’t be trusted any more is dropped', () => {
  /** A device whose clock (`wall`) can be set while a steady clock keeps running. */
  async function withSteadyClock(skewMs: number) {
    const devices = await twoManagers(0);
    const { cloud, a } = devices;
    const clock = { skew: skewMs, slept: 0 };
    const steady: Clock = {
      now: () => cloud.clock.ms + clock.skew,
      steady: () => cloud.clock.ms - clock.slept,
    };
    (a.engine as unknown as { clock: Clock }).clock = steady;
    a.engine.serverTime = null;
    a.engine.deviceStamps.clear();
    cloud.clock.tick(MIN);
    await a.cycle(); // measures: the device is `skewMs` off
    expect(offsetOf(a)).toBe(-skewMs);
    return { ...devices, clock };
  }

  it('the device’s clock is set right while offline: its own time counts again at once', async () => {
    const { cloud, a, clock } = await withSteadyClock(60 * MIN);
    cloud.fail = 'offline';
    cloud.clock.tick(MIN);
    clock.skew = 0; // the phone corrects its clock (an hour back)
    await rename(a, 'p1', 'After the correction');
    await note(a);
    // With the old measurement the change would be noted an hour in the past and lose against
    // every save of the last hour.
    expect(editTime(a, 'p1')).toBe(cloud.clock.ms);
    expect(a.engine.serverTime).toBeNull();
  });

  it('the device slept (the steady clock stood still): the device’s clock until the next pull', async () => {
    const { cloud, a, clock } = await withSteadyClock(10 * MIN);
    cloud.fail = 'offline';
    cloud.clock.tick(30 * MIN);
    clock.slept = 30 * MIN;
    await rename(a, 'p1', 'After the sleep');
    await note(a);
    expect(a.engine.serverTime).toBeNull();
    expect(editTime(a, 'p1')).toBe(cloud.clock.ms + 10 * MIN); // as before M2
    // The next pull measures again; later changes are in server time.
    cloud.fail = null;
    clock.slept = 30 * MIN;
    await a.act((e) => e.syncNow());
    expect(offsetOf(a)).toBe(-10 * MIN);
    cloud.clock.tick(MIN);
    await rename(a, 'p2', 'Awake');
    await note(a);
    expect(editTime(a, 'p2')).toBe(cloud.clock.ms);
  });

  it('small differences between the two clocks are fine', async () => {
    const { cloud, a, clock } = await withSteadyClock(10 * MIN);
    cloud.clock.tick(MIN);
    clock.skew += MAX_CLOCK_DRIFT_MS - 1;
    await rename(a, 'p1', 'Still trusted');
    await note(a);
    expect(a.engine.serverTime).not.toBeNull();
    expect(editTime(a, 'p1')).toBe(cloud.clock.ms + MAX_CLOCK_DRIFT_MS - 1);
  });

  it('a change noted before the clock was set isn’t converted (nobody knows its server time)', async () => {
    const { cloud, a, clock } = await withSteadyClock(-60 * MIN);
    a.engine.serverTime = null; // as after an app start: nothing measured yet
    cloud.fail = 'offline';
    await rename(a, 'p1', 'Noted with the wrong clock');
    await note(a);
    const noted = editTime(a, 'p1');
    expect(noted).toBe(cloud.clock.ms - 60 * MIN);
    cloud.clock.tick(MIN);
    clock.skew = 10 * MIN; // the clock is set anew (now ten minutes ahead)
    cloud.fail = null;
    // The pull measures the new difference; the push is kept away to look at the noted time.
    a.backend.pushRecords = async () => {
      throw new BackendError('forbidden', '42501');
    };
    await a.act((e) => e.syncNow());
    expect(offsetOf(a)).toBe(-10 * MIN);
    // Converting it with today's difference would move it ten more minutes into the past.
    expect(editTime(a, 'p1')).toBe(noted);
    // A change made now is noted in the server's time.
    await rename(a, 'p2', 'Noted after the pull');
    await note(a);
    expect(editTime(a, 'p2')).toBe(cloud.clock.ms);
  });

  it('a pull that took too long, or whose time can’t be read, measures nothing', async () => {
    const { cloud, a, clock } = await withSteadyClock(10 * MIN);
    const measured = a.engine.serverTime;
    const pull = a.backend.pullChanges.bind(a.backend);
    // The answer takes 12 s.
    a.backend.pullChanges = async (...args) => {
      const page = await pull(...args);
      cloud.clock.tick(12_000);
      return page;
    };
    clock.skew = 10 * MIN;
    await a.cycle();
    expect(a.engine.serverTime).toBe(measured);
    a.backend.pullChanges = async (...args) => ({ ...(await pull(...args)), serverNow: 'soon' });
    await a.cycle();
    expect(a.engine.serverTime).toBe(measured);
  });
});
