/**
 * v10 audit (docs/AUDIT_V10.md M5): a push on a slow connection. A batch may hold 512 kB; when
 * that didn't get through before the request timed out, the next cycle sent the same batch
 * again and timed out the same way — nothing of the team was ever saved.
 *
 * Now a batch that timed out is tried again in halves, and the batches stay that small for the
 * app run. Twice in one push, the cycle ends as offline and the next one continues smaller.
 * "No connection at all" (and a batch too small to blame its size) is still plain offline.
 */
import { PUSH_LIMITS } from '@/domain/syncChanges';
import { sliceToRecords, teamSlice, type TeamData } from '@/domain/syncRecords';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import type { PushItem } from '../backend';
import { downloadTeams, uploadTeams } from '../teamCommands';
import { MIN_PUSH_BYTES } from '../teamSync';

const T1 = 't1';

/** The golden team with `extra` more players of about `bytes` bytes each (at most ~530). */
function bigTeam(extra: number, bytes: number): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  // Names may be 200 characters long: the padding is shared between first and last name.
  const pad = 'n'.repeat(Math.min(190, Math.max(1, Math.floor((bytes - 150) / 2))));
  const players = slice.players.map((p) => ({ ...p, photoId: undefined }));
  return {
    ...slice,
    teams: [{ ...slice.team, profileId: PROFILE.id, photoId: undefined }],
    players: [
      ...players,
      ...Array.from({ length: extra }, (_, i) => ({
        ...players[0],
        id: `extra-${i}`,
        number: i % 100,
        firstName: `${i} ${pad}`.slice(0, 195),
        lastName: pad,
      })),
    ],
  };
}

const aborted = () => Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });

interface Uplink {
  /** The size of every push request this device tried. */
  tried: number[];
  timeouts: number;
}

/**
 * This device's uplink only gets `limit` bytes through before a request times out. With
 * `lostAnswer` the request arrives all the same and only its answer is lost.
 */
function slowUplink(d: TestDevice, limit: number, lostAnswer = false): Uplink {
  const uplink: Uplink = { tried: [], timeouts: 0 };
  const push = d.backend.pushRecords.bind(d.backend);
  d.backend.pushRecords = async (teamId: string, deviceId: string, items: readonly PushItem[]) => {
    const size = JSON.stringify(items).length;
    uplink.tried.push(size);
    if (size <= limit) return push(teamId, deviceId, items);
    uplink.timeouts += 1;
    if (lostAnswer) await push(teamId, deviceId, items);
    throw aborted();
  };
  return uplink;
}

const cloudCount = (cloud: FakeCloud) => cloud.teams.get(T1)?.records.size ?? 0;
const records = (d: TestDevice) => {
  const slice = teamSlice(d.data, T1);
  return slice
    ? Object.fromEntries([...sliceToRecords(slice)].sort(([x], [y]) => x.localeCompare(y)))
    : {};
};

async function signedIn(data: TeamData) {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', data);
  await a.signIn('anna@example.test');
  return { cloud, a };
}

describe('a push on a slow connection (audit M5)', () => {
  it('gets through in smaller batches instead of timing out the same way every cycle', async () => {
    // 300 players of ~340 bytes: the first batch (100 records) is about twice what gets through.
    const { cloud, a } = await signedIn(bigTeam(300, 340));
    const uplink = slowUplink(a, 20_000);
    await a.act((e) => uploadTeams(e, [T1])); // links the team; its own cycle pushes
    expect(uplink.tried[0]).toBeGreaterThan(20_000);
    expect(cloudCount(cloud)).toBe(22 + 300);
    expect(uplink.timeouts).toBe(1);
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 0 });
    // The batches stay small for the rest of the app run: no further timeout.
    expect(a.engine.pushLimit.bytes).toBeLessThan(PUSH_LIMITS.bytes);
    expect(a.engine.pushLimit.bytes).toBeGreaterThanOrEqual(MIN_PUSH_BYTES);
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      players: s.players.map((p) => ({ ...p, firstName: `${p.firstName}!` })),
    }));
    await a.cycle();
    expect(uplink.timeouts).toBe(1);
    expect(a.runtime.status.pending).toBe(0);
    // Another device gets the same team.
    const b = new TestDevice(cloud, 'dev-b');
    await b.signIn('anna@example.test');
    await b.act((e) => downloadTeams(e, [T1]));
    expect(records(b)).toEqual(records(a));
  });

  it('after two timeouts in one push the cycle ends as offline; the next one finishes', async () => {
    // Batches of ~50 kB against an uplink of 20 kB: 50 → 25 (still too much) → the floor.
    const { cloud, a } = await signedIn(bigTeam(300, 530));
    const uplink = slowUplink(a, 20_000);
    await a.act((e) => uploadTeams(e, [T1]));
    expect(uplink.timeouts).toBe(2);
    expect(a.runtime.status.phase).toBe('offline');
    expect(cloudCount(cloud)).toBe(0);
    expect(a.engine.pushLimit.bytes).toBeLessThanOrEqual(20_000);
    await a.act((e) => e.syncNow());
    expect(uplink.timeouts).toBe(2);
    expect(cloudCount(cloud)).toBe(22 + 300);
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 0 });
  });

  it('a push that arrived although its answer was lost is repeated safely in halves', async () => {
    const { cloud, a } = await signedIn(bigTeam(300, 340));
    const uplink = slowUplink(a, 20_000, true);
    await a.act((e) => uploadTeams(e, [T1]));
    expect(uplink.timeouts).toBe(1);
    expect(cloudCount(cloud)).toBe(22 + 300);
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 0 });
    expect(a.data.players).toHaveLength(8 + 300);
    cloud.clock.tick(60_000);
    const before = uplink.tried.length;
    await a.cycle();
    expect(uplink.tried.length).toBe(before); // nothing left to push
    const b = new TestDevice(cloud, 'dev-b');
    await b.signIn('anna@example.test');
    await b.act((e) => downloadTeams(e, [T1]));
    expect(records(b)).toEqual(records(a));
  });

  it('no connection at all isn’t taken for a slow one: one try, the batch size stays', async () => {
    const { cloud, a } = await signedIn(bigTeam(300, 340));
    let tries = 0;
    a.backend.pushRecords = async () => {
      tries += 1;
      throw new TypeError('Network request failed');
    };
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    expect(tries).toBe(2); // the upload's own cycle and this one: one try each
    expect(a.runtime.status.phase).toBe('offline');
    expect(a.engine.pushLimit).toEqual(PUSH_LIMITS);
    expect(cloudCount(cloud)).toBe(0);
  });

  it('a small batch that gets no answer isn’t split: the connection is gone, not slow', async () => {
    const { a } = await signedIn(bigTeam(0, 0));
    const uplink = slowUplink(a, 0);
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    expect(uplink.tried.every((size) => size < MIN_PUSH_BYTES)).toBe(true);
    expect(uplink.tried).toHaveLength(2); // one try per cycle
    expect(a.engine.pushLimit).toEqual(PUSH_LIMITS);
    expect(a.runtime.status.phase).toBe('offline');
  });

  it('never makes the batches smaller than the floor, however often it times out', async () => {
    const { a } = await signedIn(bigTeam(300, 340));
    slowUplink(a, 0); // nothing gets through
    await a.act((e) => uploadTeams(e, [T1]));
    for (let i = 0; i < 6; i += 1) await a.act((e) => e.syncNow());
    expect(a.engine.pushLimit.bytes).toBeGreaterThanOrEqual(MIN_PUSH_BYTES);
    expect(a.engine.pushLimit.bytes).toBeLessThan(2 * MIN_PUSH_BYTES);
    expect(a.engine.pushLimit.count).toBe(PUSH_LIMITS.count);
  });
});
