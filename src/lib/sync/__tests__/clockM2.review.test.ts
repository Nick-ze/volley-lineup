/**
 * v10 audit M2 (clock offset), NOT MERGED: the sequences of the independent review. With the
 * reviewer's fix (a record changed again never gets a time at or before the change it replaces;
 * changes sent with a device time aren't converted until their answer arrives) all pass except
 * the two marked `it.failing`. See docs/AUDIT_V10.md, "PR 4".
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { createInvite } from '../memberCommands';
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

/** The app is closed and opened again: a new engine (nothing in memory) on the stored data. */
async function restart(old: TestDevice, email: string, skewMs: number): Promise<TestDevice> {
  const d = new TestDevice(old.cloud, old.name, {}, { skewMs });
  d.data = old.data;
  d.photos = old.photos;
  const session = d.backend.signInAs(email);
  await d.act((e) => e.setSession(session));
  return d;
}

const rename = (d: TestDevice, id: string, firstName: string) =>
  d.edit((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, firstName } : p)) }));
const name = (d: TestDevice, id: string) => d.data.players.find((p) => p.id === id)?.firstName;
const cloudName = (cloud: FakeCloud, id: string) =>
  (cloud.record(T1, 'player', id)?.payload as { firstName?: string } | undefined)?.firstName;
const editAt = (d: TestDevice, id: string) => d.data.sync.teams[T1].edits[`player:${id}`]?.at;

/** The next push reaches the server, but its answer is lost (or the app is killed before it). */
function loseNextPushAnswer(d: TestDevice): void {
  const push = d.backend.pushRecords.bind(d.backend);
  d.backend.pushRecords = async (...args) => {
    d.backend.pushRecords = push;
    await push(...args);
    throw new TypeError('Network request failed');
  };
}

describe('one device, its own two saves of one record (no other device involved)', () => {
  it('SLOW clock: save (answer lost) → restart, edit offline → restart, online', async () => {
    const SKEW = -10 * MIN;
    const { cloud, a } = await twoManagers(SKEW);
    // Run 1 (online, the offset is known): the change goes out, its answer is lost.
    cloud.clock.tick(MIN);
    await rename(a, 'p1', 'First');
    loseNextPushAnswer(a);
    await a.cycle();
    expect(cloudName(cloud, 'p1')).toBe('First');
    const firstAt = cloud.record(T1, 'player', 'p1')?.at ?? 0;
    // Run 2 (no connection): the same player is changed again, two minutes later.
    cloud.clock.tick(2 * MIN);
    cloud.fail = 'offline';
    const a2 = await restart(a, 'anna@example.test', SKEW);
    await rename(a2, 'p1', 'Second');
    await a2.cycle();
    const secondAt = Date.parse(editAt(a2, 'p1') ?? '');
    // Run 3 (online).
    cloud.clock.tick(MIN);
    cloud.fail = null;
    const a3 = await restart(a2, 'anna@example.test', SKEW);
    await a3.cycle();
    await a3.cycle();

    console.log(
      `SLOW: server row at ${new Date(firstAt).toISOString()}, later edit noted ${new Date(secondAt).toISOString()} → device "${name(a3, 'p1')}", cloud "${cloudName(cloud, 'p1')}"`,
    );
    expect(name(a3, 'p1')).toBe('Second');
    expect(cloudName(cloud, 'p1')).toBe('Second');
  });

  it('FAST clock: edit offline → restart, online, save (answer lost) → edit again 20 s later', async () => {
    const SKEW = 10 * MIN;
    const { cloud, a } = await twoManagers(SKEW);
    // Run 2 (no connection from start to close).
    cloud.clock.tick(MIN);
    cloud.fail = 'offline';
    const a2 = await restart(a, 'anna@example.test', SKEW);
    await rename(a2, 'p1', 'First');
    await a2.cycle();
    // Run 3 (online): the change goes out, its answer is lost.
    cloud.clock.tick(MIN);
    cloud.fail = null;
    const a3 = await restart(a2, 'anna@example.test', SKEW);
    loseNextPushAnswer(a3);
    await a3.cycle();
    expect(cloudName(cloud, 'p1')).toBe('First');
    const firstAt = cloud.record(T1, 'player', 'p1')?.at ?? 0;
    // 20 s later the same player is changed again.
    cloud.clock.tick(20_000);
    await rename(a3, 'p1', 'Second');
    await a3.act((e) => noteAll(e)); // what the engine does 3 s after a change
    const secondAt = editAt(a3, 'p1');
    await a3.cycle();
    await a3.cycle();

    console.log(
      `FAST: server row at ${new Date(firstAt).toISOString()}, later edit noted ${secondAt} → device "${name(a3, 'p1')}", cloud "${cloudName(cloud, 'p1')}"`,
    );
    expect(name(a3, 'p1')).toBe('Second');
    expect(cloudName(cloud, 'p1')).toBe('Second');
  });
});

/** The device's next pull is slow: `upMs` until the server reads its clock, `downMs` after. */
function slowNextPull(d: TestDevice, upMs: number, downMs: number): void {
  const pull = d.backend.pullChanges.bind(d.backend);
  d.backend.pullChanges = async (...args) => {
    d.backend.pullChanges = pull;
    d.cloud.clock.tick(upMs);
    const page = await pull(...args);
    d.cloud.clock.tick(downMs);
    return page;
  };
}

describe('a device whose clock is RIGHT, on a slow connection', () => {
  it('its own later edit survives its own earlier save coming back (answer lost)', async () => {
    const { cloud, a } = await twoManagers(0);
    slowNextPull(a, 8000, 0); // the request crawls up: the measured offset is +4 s
    await a.cycle();
    cloud.clock.tick(MIN / 2);
    await rename(a, 'p1', 'First');
    loseNextPushAnswer(a);
    await a.cycle(); // noted with the +4 s offset; this cycle's pull is fast (offset 0)
    expect(cloudName(cloud, 'p1')).toBe('First');
    const firstAt = cloud.record(T1, 'player', 'p1')?.at ?? 0;
    cloud.clock.tick(3000);
    await rename(a, 'p1', 'Second');
    await a.act((e) => noteAll(e));
    const secondAt = editAt(a, 'p1');
    await a.cycle();
    await a.cycle();

    console.log(
      `RIGHT/own: now ${new Date(cloud.clock.ms).toISOString()}, server row at ${new Date(firstAt).toISOString()}, later edit noted ${secondAt} → device "${name(a, 'p1')}", cloud "${cloudName(cloud, 'p1')}"`,
    );
    expect(name(a, 'p1')).toBe('Second');
    expect(cloudName(cloud, 'p1')).toBe('Second');
  });

  // KNOWN OPEN (docs/AUDIT_V10.md, "PR 4"): a pull whose answer is slow makes a right clock up to
  // ±5 s wrong. `it.failing`: this test passes while the problem exists.
  it.failing('its save, 2 s after another device’s save of the same record, wins', async () => {
    const { cloud, a, b } = await twoManagers(0);
    slowNextPull(a, 0, 8000); // the answer crawls down: the measured offset is -4 s
    await a.cycle();
    cloud.clock.tick(MIN / 2);
    await rename(b, 'p1', 'B, earlier');
    await b.cycle();
    cloud.clock.tick(2000);
    await rename(a, 'p1', 'A, later');
    await a.act((e) => noteAll(e));
    const noted = editAt(a, 'p1');
    await a.cycle();
    await a.cycle();
    await b.cycle();

    console.log(
      `RIGHT/two: B saved at ${new Date(cloud.clock.ms - 2000).toISOString()}, A (2 s later) noted ${noted} → A "${name(a, 'p1')}", B "${name(b, 'p1')}", cloud "${cloudName(cloud, 'p1')}"`,
    );
    expect(cloudName(cloud, 'p1')).toBe('A, later');
  });
});

describe('a phone that sleeps (the steady clock stands still), SLOW clock, no restart', () => {
  it('save (answer lost) → sleep, edit offline → sleep → online', async () => {
    const SKEW = -10 * MIN;
    const { cloud, a } = await twoManagers(SKEW);
    let slept = 0;
    const sleep = (ms: number) => {
      cloud.clock.tick(ms);
      slept += ms;
    };
    (a.engine as unknown as { clock: unknown }).clock = {
      now: () => cloud.clock.ms + SKEW,
      steady: () => cloud.clock.ms - slept,
    };
    cloud.clock.tick(MIN);
    await a.cycle(); // measured with the steady clock in place
    await rename(a, 'p1', 'First');
    loseNextPushAnswer(a);
    await a.cycle();
    expect(cloudName(cloud, 'p1')).toBe('First');
    const firstAt = cloud.record(T1, 'player', 'p1')?.at ?? 0;
    // In the hall, no connection; the phone was in the pocket for two minutes.
    cloud.fail = 'offline';
    sleep(2 * MIN);
    await rename(a, 'p1', 'Second');
    await a.cycle();
    const secondAt = editAt(a, 'p1');
    // In the pocket again; then the connection is back.
    sleep(MIN);
    cloud.fail = null;
    await a.act((e) => e.syncNow());
    await a.cycle();

    console.log(
      `SLEEP: server row at ${new Date(firstAt).toISOString()}, later edit noted ${secondAt} → device "${name(a, 'p1')}", cloud "${cloudName(cloud, 'p1')}"`,
    );
    expect(name(a, 'p1')).toBe('Second');
    expect(cloudName(cloud, 'p1')).toBe('Second');
  });
});

describe('no answer lost: how long a change takes', () => {
  // KNOWN OPEN (docs/AUDIT_V10.md, "PR 4"): after a clock switch a change is refused once and
  // goes out a cycle later. `it.failing`: this test passes while the problem exists.
  it.failing(
    'SLOW clock: save → restart, edit offline → restart, online: sent by the first cycle',
    async () => {
      const SKEW = -10 * MIN;
      const { cloud, a } = await twoManagers(SKEW);
      cloud.clock.tick(MIN);
      await rename(a, 'p1', 'First');
      await a.cycle();
      cloud.clock.tick(2 * MIN);
      cloud.fail = 'offline';
      const a2 = await restart(a, 'anna@example.test', SKEW);
      await rename(a2, 'p1', 'Second');
      await a2.cycle();
      cloud.clock.tick(MIN);
      cloud.fail = null;
      const a3 = await restart(a2, 'anna@example.test', SKEW);
      await a3.cycle();

      console.log(
        `DELAY: after the first online cycle: cloud "${cloudName(cloud, 'p1')}", pending ${a3.runtime.status.pending}, phase ${a3.runtime.status.phase}`,
      );
      expect(cloudName(cloud, 'p1')).toBe('Second');
    },
  );
});

describe('one restart, never offline: the first pull of the new app run is slow', () => {
  it('SLOW clock: save (answer lost) → restart → edit → a pull of 12 s', async () => {
    const SKEW = -10 * MIN;
    const { cloud, a } = await twoManagers(SKEW);
    cloud.clock.tick(MIN);
    await rename(a, 'p1', 'First');
    loseNextPushAnswer(a);
    await a.cycle();
    expect(cloudName(cloud, 'p1')).toBe('First');
    cloud.clock.tick(MIN);
    const a2 = await restart(a, 'anna@example.test', SKEW);
    await rename(a2, 'p1', 'Second');
    slowNextPull(a2, 6000, 6000);
    await a2.cycle();
    await a2.cycle();

    console.log(`SLOW/slow pull: device "${name(a2, 'p1')}", cloud "${cloudName(cloud, 'p1')}"`);
    expect(name(a2, 'p1')).toBe('Second');
    expect(cloudName(cloud, 'p1')).toBe('Second');
  });
});

describe('the conversion moves a save time to before this device’s own save on the server', () => {
  it('FAST clock, one app run, never offline: slow first pull, save (answer lost) → edit again → pull', async () => {
    const SKEW = 10 * MIN;
    const { cloud, a } = await twoManagers(SKEW);
    cloud.clock.tick(MIN);
    const a2 = await restart(a, 'anna@example.test', SKEW);
    await rename(a2, 'p1', 'First');
    slowNextPull(a2, 6000, 6000); // 12 s: nothing is measured
    loseNextPushAnswer(a2);
    await a2.cycle();
    expect(cloudName(cloud, 'p1')).toBe('First');
    const firstAt = cloud.record(T1, 'player', 'p1')?.at ?? 0;
    cloud.clock.tick(10_000);
    await rename(a2, 'p1', 'Second');
    await a2.act((e) => noteAll(e)); // 3 s after the change: noted with the device's clock
    const noted = editAt(a2, 'p1');
    await a2.cycle(); // a fast pull: measured, the time above is converted, then the merge
    await a2.cycle();

    console.log(
      `FAST/convert: now ${new Date(cloud.clock.ms).toISOString()}, server row at ${new Date(firstAt).toISOString()}, later edit noted ${noted} → device "${name(a2, 'p1')}", cloud "${cloudName(cloud, 'p1')}"`,
    );
    expect(name(a2, 'p1')).toBe('Second');
    expect(cloudName(cloud, 'p1')).toBe('Second');
  });
});
