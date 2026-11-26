/**
 * v10 audit L6, from the independent review of its fix: what an app update's "pull everything
 * once more" must not do on a view-only device. The first version of the fix set the pull cursor
 * to 0; a viewer with cursor 0 and a `base` gets the "replace by the cloud's copy" pull
 * (`needsReset`, `resetToCloudMerge`), and that
 * - deleted the device's copy of every record whose newest cloud row it still can't read, with
 *   everything below it (1a);
 * - applied nothing when the team's own row was such a row, but moved the cursor past everything
 *   that had changed meanwhile (1b);
 * - never brings a deleted player back, so a lineup lost a player the managers got back (1c).
 * The cursor now goes to `REPULL_CURSOR`: the same rows, merged the normal way. Each scenario
 * runs without the update (how it was before) and with it: the outcome must be the same.
 */
import { sliceToRecords, teamSlice, type TeamData } from '@/domain/syncRecords';
import { useAppStore } from '@/store';
import { migrateStore, STORE_VERSION } from '@/store/migrations';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { createInvite } from '../memberCommands';
import { downloadTeams, joinTeam, uploadTeams } from '../teamCommands';

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

/** Managers A and B (one account) and viewer C share t1, all in sync. */
async function shared() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b');
  const c = new TestDevice(cloud, 'dev-c');
  await a.signIn('anna@example.test');
  await b.signIn('anna@example.test');
  await c.signIn('cara@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  await b.act((e) => downloadTeams(e, [T1]));
  const invite = await a.act((e) => createInvite(e, T1, 'player', 7));
  if (!invite.ok) throw new Error('no invite');
  await c.act((e) => joinTeam(e, invite.value.code));
  cloud.clock.tick(60_000);
  for (const d of [a, b, c]) await d.cycle();
  return { cloud, a, b, c };
}

/** The app update on the viewer: a new app run, the store migrated to the next version. */
function updateApp(d: TestDevice): void {
  d.engine.resetPending.clear();
  d.engine.notified.clear();
  d.data = migrateStore(d.data, STORE_VERSION, STORE_VERSION + 1) as TestDevice['data'];
}

const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id).sort();
const firstName = (d: TestDevice, id: string) => d.data.players.find((p) => p.id === id)?.firstName;
const record = (d: TestDevice, key: string): unknown => {
  const slice = teamSlice(d.data, T1);
  return slice ? sliceToRecords(slice).get(key) : undefined;
};

describe.each([false, true])('a view-only device, app updated: %s', (update) => {
  it('1a keeps its copy of a season (and its matches) whose newest row it can’t read', async () => {
    const { cloud, a, c } = await shared();
    // A manager gives season s1 a name this app version refuses on pull (> 200 characters;
    // nothing stops the push: audit M3). The same happens with a row of a still newer app.
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      seasons: s.seasons.map((x) => (x.id === 's1' ? { ...x, name: 'S'.repeat(201) } : x)),
    }));
    await a.cycle();
    for (let i = 0; i < 2; i += 1) {
      cloud.clock.tick(60_000);
      await c.cycle();
    }
    expect(ids(c.data.matches)).toEqual(['m1', 'm2']); // the viewer skipped the row, kept its copy
    if (update) updateApp(c);
    cloud.clock.tick(60_000);
    await c.cycle();
    expect(cloud.record(T1, 'match', 'm1')?.deleted).toBe(false);
    expect(ids(c.data.seasons)).toEqual(['s1', 's2']);
    expect(ids(c.data.opponents)).toEqual(['o1', 'o2', 'o3']);
    expect(ids(c.data.matches)).toEqual(['m1', 'm2']);
    // The manager shortens the name: even then the season's match doesn't come back.
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      seasons: s.seasons.map((x) => (x.id === 's1' ? { ...x, name: 'Short' } : x)),
    }));
    await a.cycle();
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await c.cycle();
    }
    expect(ids(c.data.matches)).toEqual(['m1', 'm2']);
  });

  it('1b gets what changed while the app was closed, also when the team’s own row is unreadable', async () => {
    const { cloud, a, c } = await shared();
    cloud.clock.tick(3_600_000);
    await a.edit((s) => ({
      teams: s.teams.map((t) => (t.id === T1 ? { ...t, name: 'T'.repeat(201) } : t)),
      players: [
        ...s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Renamed' } : p)),
        { ...s.players[0], id: 'p-added', number: 77, firstName: 'Added' },
      ],
    }));
    await a.cycle();
    cloud.clock.tick(3_600_000);
    if (update) updateApp(c);
    await c.cycle();
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      teams: s.teams.map((t) => (t.id === T1 ? { ...t, name: 'Readable' } : t)),
    }));
    await a.cycle();
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await c.cycle();
    }
    expect(c.data.teams[0].name).toBe('Readable');
    expect(firstName(c, 'p1')).toBe('Renamed');
    expect(firstName(c, 'p-added')).toBe('Added');
  });

  it('1c ends with the managers’ lineup when a deleted player is brought back', async () => {
    const { cloud, a, b, c } = await shared();
    // Manager A, offline, deletes p1 (the app takes p1 out of every lineup on A).
    cloud.clock.tick(60_000);
    await a.act(async (e) => {
      useAppStore.getState().deletePlayer('p1');
      cloud.fail = 'offline';
      await e.runCycle();
      cloud.fail = null;
    });
    // Ten seconds later manager B renames the preset that names p1, and syncs.
    cloud.clock.tick(10_000);
    await b.act(async (e) => {
      useAppStore.getState().updatePreset('ps2', { name: 'Strong serve 2' });
      await e.runCycle();
    });
    // A is online again: the cloud has p1's tombstone and B's newer preset naming p1.
    cloud.clock.tick(10_000);
    await a.act((e) => e.syncNow());
    expect(cloud.record(T1, 'player', 'p1')?.deleted).toBe(true);
    // The viewer syncs before B does.
    if (update) updateApp(c);
    cloud.clock.tick(5_000);
    await c.cycle();
    // B syncs: its preset still needs p1, so B brings p1 back for everyone.
    for (let i = 0; i < 3; i += 1) {
      for (const d of [b, a, c]) {
        cloud.clock.tick(30_000);
        await d.cycle();
      }
    }
    expect(cloud.record(T1, 'player', 'p1')?.deleted).toBe(false);
    expect(record(c, 'player:p1')).toEqual(record(a, 'player:p1'));
    expect(record(c, 'preset:ps2')).toEqual(record(a, 'preset:ps2'));
  });
});
