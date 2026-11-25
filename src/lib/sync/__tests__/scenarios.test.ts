/**
 * v10 sync engine: the PR #92 review's scenarios — the server keeping this device's own earlier
 * save, races with another device, two managers offline, a viewer, removal and demotion (also
 * across an app restart), delete vs edit, live holds and an older offline edit.
 */
import { sliceToRecords, teamSlice, type TeamData } from '@/domain/syncRecords';
import type { Clock } from '@/lib/sync/core';
import { createEngine } from '@/lib/sync/engine';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { createInvite, removeMember, setMemberRole } from '../memberCommands';
import { holdMatch } from '../holdCommands';
import { deleteTeamEverywhere, downloadTeams, joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}
const records = (d: TestDevice) => {
  const slice = teamSlice(d.data, T1);
  return slice
    ? Object.fromEntries([...sliceToRecords(slice)].sort(([x], [y]) => x.localeCompare(y)))
    : {};
};
const name = (d: TestDevice, id: string) => d.data.players.find((p) => p.id === id)?.firstName;
const rename = (d: TestDevice, id: string, firstName: string) =>
  d.edit((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, firstName } : p)) }));
const pushes = (cloud: FakeCloud) => cloud.calls.filter((c) => c === 'pushRecords').length;
const setClock = (d: TestDevice, clock: Clock) => {
  (d.engine as unknown as { clock: Clock }).clock = clock;
};

async function sameAccount() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('anna@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  await b.act((e) => downloadTeams(e, [T1]));
  await b.cycle(); // joins the cycle the download kicked (else it runs on another device's store)
  return { cloud, a, b };
}

async function shared(role: 'manager' | 'player') {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('ben@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  const invite = await a.act((e) => createInvite(e, T1, role, 7));
  if (!invite.ok) throw new Error('no invite');
  await b.act((e) => joinTeam(e, invite.value.code));
  await b.cycle();
  return { cloud, a, b };
}

describe('review: own earlier save kept by the server (clock jumped back)', () => {
  it('converges in at most 2 pushes, the newer change kept', async () => {
    const { cloud, a, b } = await sameAccount();
    cloud.clock.tick(20_000);
    await rename(a, 'p1', 'First');
    await a.cycle(); // applied, base.v = server version, base.at = T
    cloud.clock.tick(20_000);
    // The device clock jumps back one hour.
    setClock(a, { now: () => cloud.clock.ms - 3_600_000 });
    await rename(a, 'p1', 'Second');
    const before = pushes(cloud);
    for (let i = 0; i < 5; i += 1) {
      cloud.clock.tick(20_000);
      await a.cycle();
    }
    await b.cycle();
    expect(name(a, 'p1')).toBe('Second');
    expect(name(b, 'p1')).toBe('Second');
    expect(pushes(cloud) - before).toBeLessThanOrEqual(2);
  });
});

describe('review: rejected push of a row from ANOTHER device', () => {
  it('converges (race: B writes between A’s pull and A’s push)', async () => {
    const { cloud, a, b } = await sameAccount();
    cloud.clock.tick(20_000);
    await rename(a, 'p1', 'From A');
    // Right after A's pull, B's later save lands on the server.
    const pull = a.backend.pullChanges.bind(a.backend);
    let once = true;
    a.backend.pullChanges = async (...args) => {
      const page = await pull(...args);
      if (once) {
        once = false;
        const row = cloud.record(T1, 'player', 'p1');
        if (!row) throw new Error('no row');
        cloud.version += 1;
        cloud.teams.get(T1)?.records.set('player:p1', {
          ...row,
          payload: { ...(row.payload as object), firstName: 'From B' },
          at: cloud.clock.ms + 5_000,
          version: cloud.version,
          deviceId: 'dev-b',
        });
      }
      return page;
    };
    await a.cycle();
    const mark = pushes(cloud);
    cloud.clock.tick(20_000);
    await a.cycle();
    await a.cycle();
    await b.cycle();
    expect(name(a, 'p1')).toBe('From B');
    expect(name(b, 'p1')).toBe('From B');
    expect(a.runtime.status.pending).toBe(0);
    expect(pushes(cloud) - mark).toBe(0);
  });

  it('equal save time, tie-break by device id: converges', async () => {
    const { cloud, a, b } = await sameAccount();
    cloud.clock.tick(20_000);
    // Same instant on both (A = 'dev-a' < 'dev-b' loses the tie).
    await rename(a, 'p1', 'A same ms');
    await rename(b, 'p1', 'B same ms');
    await a.act((e) => e.runCycle()); // A notes + pushes first (applied)
    await b.cycle(); // B pulls A's row (same at; B's edit wins the merge tie? then pushes)
    await a.cycle();
    await b.cycle();
    const mark = pushes(cloud);
    cloud.clock.tick(20_000);
    await a.cycle();
    await b.cycle();
    expect(name(a, 'p1')).toBe(name(b, 'p1'));
    expect(pushes(cloud) - mark).toBe(0);
  });
});

describe('review: multi-device scenarios', () => {
  it('two managers edit offline, then sync: converge and go quiet', async () => {
    const { cloud, a, b } = await shared('manager');
    cloud.fail = 'offline';
    await a.cycle();
    await b.cycle();
    cloud.clock.tick(1000);
    await rename(a, 'p1', 'A1');
    await rename(b, 'p2', 'B2');
    cloud.clock.tick(1000);
    await rename(a, 'p3', 'A3 early');
    await a.act((e) => e.runCycle()); // offline: notes the edits
    cloud.clock.tick(1000);
    await rename(b, 'p3', 'B3 later');
    await b.act((e) => e.runCycle());
    await b.edit((s) => ({ presets: s.presets.filter((p) => p.kind !== 'preset') }));
    expect(a.runtime.status.phase).toBe('offline');
    cloud.fail = null;
    await a.act((e) => e.syncNow());
    await b.act((e) => e.syncNow());
    await a.cycle();
    cloud.clock.tick(20_000);
    await a.cycle();
    await b.cycle();
    expect(records(a)).toEqual(records(b));
    expect(name(a, 'p3')).toBe('B3 later');
    expect(name(a, 'p1')).toBe('A1');
    expect(name(b, 'p2')).toBe('B2');
    const mark = pushes(cloud);
    await a.cycle();
    await b.cycle();
    expect(pushes(cloud)).toBe(mark);
    expect(a.runtime.status.pending + b.runtime.status.pending).toBe(0);
  });

  it('a viewer follows edits, never pushes, local changes overwritten', async () => {
    const { cloud, a, b } = await shared('player');
    const mark = pushes(cloud);
    await rename(b, 'p1', 'Viewer edit');
    cloud.clock.tick(1000);
    await rename(a, 'p2', 'Manager edit');
    await a.cycle();
    const before = pushes(cloud);
    await b.cycle();
    expect(pushes(cloud)).toBe(before);
    expect(pushes(cloud) - mark).toBe(1);
    expect(name(b, 'p2')).toBe('Manager edit');
  });

  it('removal while offline with pending edits: unlinked, local copy keeps the edits', async () => {
    const { cloud, a, b } = await shared('manager');
    await rename(b, 'p1', 'Kept locally');
    await a.act((e) => removeMember(e, T1, cloud.userId('ben@example.test')));
    await b.cycle();
    expect(b.data.sync.teams[T1]).toBeUndefined();
    expect(name(b, 'p1')).toBe('Kept locally');
    expect(b.runtime.notices.map((n) => n.kind)).toEqual(['removed']);
  });

  it('demotion followed by an app restart before the reset pull', async () => {
    const { cloud, a, b } = await shared('manager');
    cloud.clock.tick(20_000);
    await a.cycle();
    await b.cycle();
    await rename(b, 'p2', 'Unsynced');
    await a.act((e) => setMemberRole(e, T1, cloud.userId('ben@example.test'), 'player'));
    // Memberships are refreshed, then the pull fails (connection drops mid-cycle).
    const pull = b.backend.pullChanges.bind(b.backend);
    b.backend.pullChanges = async () => {
      throw new TypeError('Network request failed');
    };
    await b.cycle();
    expect(b.data.sync.teams[T1].role).toBe('player');
    b.backend.pullChanges = pull;
    // The app restarts: a new engine (resetPending is in memory only).
    const fresh = createEngine(b.backend, { now: () => cloud.clock.ms });
    await b.act(async () => {
      fresh.setSession(b.backend.session);
      await fresh.runCycle();
    });
    expect(records(b)).toEqual(records(a));
    expect(name(b, 'p2')).toBe(name(a, 'p2'));
    expect(b.data.sync.teams[T1].edits).toEqual({});
  });

  it('delete a match vs a later edit of one of its sets', async () => {
    const { cloud, a, b } = await shared('manager');
    cloud.clock.tick(1000);
    await a.edit((s) => ({ matches: s.matches.filter((m) => m.id !== 'm2') }));
    await a.cycle();
    cloud.clock.tick(5000);
    await b.edit((s) => ({
      matches: s.matches.map((m) =>
        m.id === 'm2'
          ? {
              ...m,
              sets: m.sets.map((x, i) =>
                i === 0
                  ? { ...x, events: [...(x.events ?? []), { type: 'point', winner: 'them' }] }
                  : x,
              ),
            }
          : m,
      ),
    }));
    await b.cycle();
    await a.cycle();
    await b.cycle();
    expect(records(a)).toEqual(records(b));
  });

  it('live scoring with a hold: B refused, takes over, both see it', async () => {
    const { cloud, a, b } = await shared('manager');
    const granted = await a.act((e) => holdMatch(e, T1, 'm2', false));
    expect(granted).toEqual({ ok: true, value: { granted: true } });
    expect(a.runtime.holds.m2?.deviceId).toBe('dev-a');
    const refused = await b.act((e) => holdMatch(e, T1, 'm2', false));
    expect(refused.ok && refused.value.granted).toBe(false);
    expect(b.runtime.holds.m2?.deviceId).not.toBe('dev-b');
    const taken = await b.act((e) => holdMatch(e, T1, 'm2', true));
    expect(taken.ok && taken.value.granted).toBe(true);
    expect(b.runtime.holds.m2?.deviceId).toBe('dev-b');
    await b.edit((s) => ({
      matches: s.matches.map((m) =>
        m.id === 'm2'
          ? {
              ...m,
              sets: m.sets.map((x, i) =>
                i === 0
                  ? { ...x, events: [...(x.events ?? []), { type: 'point', winner: 'us' }] }
                  : x,
              ),
            }
          : m,
      ),
    }));
    cloud.clock.tick(2000);
    await b.cycle();
    await a.cycle();
    expect(a.runtime.holds.m2?.deviceId).toBe('dev-b');
    expect(records(a)).toEqual(records(b));
  });

  it('delete for everyone: the other device is unlinked, keeps its copy', async () => {
    const { a, b } = await shared('manager');
    const r = await a.act((e) => deleteTeamEverywhere(e, T1));
    expect(r.ok).toBe(true);
    await b.cycle();
    expect(b.data.sync.teams[T1]).toBeUndefined();
    expect(teamSlice(b.data, T1)).toBeDefined();
  });
});

describe('review: save time of an offline edit', () => {
  it('an older offline edit must not beat a newer online edit', async () => {
    const { cloud, a, b } = await shared('manager');
    cloud.clock.tick(20_000);
    let aOffline = true;
    const memberships = a.backend.memberships.bind(a.backend);
    a.backend.memberships = async () => {
      if (aOffline) throw new TypeError('Network request failed');
      return memberships();
    };
    cloud.clock.tick(1000);
    await rename(a, 'p3', 'A offline (older)');
    await a.cycle(); // offline
    cloud.clock.tick(4000);
    await rename(b, 'p3', 'B online (newer)');
    await b.cycle();
    cloud.clock.tick(5000);
    aOffline = false;
    await a.act((e) => e.syncNow());
    await b.cycle();
    expect(name(a, 'p3')).toBe('B online (newer)');
    expect(name(b, 'p3')).toBe('B online (newer)');
  });
});
