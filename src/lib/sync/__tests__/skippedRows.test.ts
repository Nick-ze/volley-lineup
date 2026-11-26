/**
 * v10 audit (docs/AUDIT_V10.md L6): a record this app version can't read is skipped, and once
 * the team's pull cursor has passed it, it is never pulled again — also not after an app update
 * that could read it. The device then lacks that record for good (until someone changes it).
 *
 * The update's store migration now puts the pull cursors back at 0 (`migrateStore`, every step
 * from v13 on), so each shared team is pulled once more from the start.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { migrateStore, STORE_VERSION } from '@/store/migrations';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import type { PushItem } from '../backend';
import { createInvite } from '../memberCommands';
import { downloadTeams, joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const NEW = 'p-new';

/** While `on`, row validation refuses the record a newer app version wrote (the "old app"). */
const mockOldApp = { on: true };

jest.mock('@/domain/syncSchema', () => {
  const actual = jest.requireActual<typeof import('@/domain/syncSchema')>('@/domain/syncSchema');
  return {
    ...actual,
    parseRemoteRow: (row: unknown) =>
      mockOldApp.on && (row as { id?: unknown } | null)?.id === 'p-new'
        ? null
        : actual.parseRemoteRow(row),
  };
});

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

const has = (d: TestDevice, id: string) => d.data.players.some((p) => p.id === id);

function watchPushes(d: TestDevice): string[] {
  const pushed: string[] = [];
  const push = d.backend.pushRecords.bind(d.backend);
  d.backend.pushRecords = async (teamId: string, deviceId: string, items: readonly PushItem[]) => {
    pushed.push(...items.map((i) => `${i.kind}:${i.id}`));
    return push(teamId, deviceId, items);
  };
  return pushed;
}

/** The app update: the stored data goes through the store migration to the next version. */
function updateApp(d: TestDevice): void {
  mockOldApp.on = false;
  d.data = migrateStore(d.data, STORE_VERSION, STORE_VERSION + 1) as TestDevice['data'];
}

/**
 * A (the newer app) adds a player that B's app version can't read; a later change moves B's pull
 * cursor past the skipped row.
 */
async function skippedOnB(role: 'manager' | 'player') {
  mockOldApp.on = true;
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  if (role === 'manager') {
    await b.signIn('anna@example.test');
    await b.act((e) => downloadTeams(e, [T1]));
  } else {
    await b.signIn('ben@example.test');
    const invite = await a.act((e) => createInvite(e, T1, 'player', 7));
    if (!invite.ok) throw new Error('no invite');
    await b.act((e) => joinTeam(e, invite.value.code));
  }
  cloud.clock.tick(60_000);
  await b.cycle();

  mockOldApp.on = false; // A runs the newer app
  await a.edit((s) => ({
    players: [...s.players, { ...s.players[0], id: NEW, number: 98, firstName: 'Newer app' }],
  }));
  await a.cycle();
  mockOldApp.on = true;
  cloud.clock.tick(60_000);
  await b.cycle();
  expect(has(b, NEW)).toBe(false);
  expect(b.runtime.notices.map((n) => n.kind)).toContain('skipped');

  mockOldApp.on = false;
  await a.edit((s) => ({
    players: s.players.map((p) => (p.id === 'p2' ? { ...p, firstName: 'Later' } : p)),
  }));
  await a.cycle();
  mockOldApp.on = true;
  cloud.clock.tick(60_000);
  await b.cycle();
  cloud.clock.tick(60_000);
  await b.cycle();
  const skippedRow = cloud.record(T1, 'player', NEW);
  if (!skippedRow) throw new Error('no row');
  expect(b.data.sync.teams[T1].cursor).toBeGreaterThan(skippedRow.version);
  return { cloud, a, b };
}

afterEach(() => {
  mockOldApp.on = false;
});

describe('a record an older app version skipped (audit L6)', () => {
  it('stays away after the update when nothing resets the cursor (the finding)', async () => {
    const { cloud, b } = await skippedOnB('manager');
    mockOldApp.on = false; // the updated app could read it — but it is never pulled again
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    expect(has(b, NEW)).toBe(false);
  });

  it('arrives on a manager device after the update’s store migration; nothing is pushed', async () => {
    const { cloud, a, b } = await skippedOnB('manager');
    updateApp(b);
    expect(b.data.sync.teams[T1].cursor).toBe(0);
    const pushed = watchPushes(b);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(has(b, NEW)).toBe(true);
    expect(b.data.players.find((p) => p.id === NEW)?.firstName).toBe('Newer app');
    expect(b.data.players.find((p) => p.id === 'p2')?.firstName).toBe('Later');
    expect(b.data.sync.teams[T1].cursor).toBeGreaterThan(0);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(pushed).toEqual([]);
    expect(b.runtime.status.pending).toBe(0);
    await a.cycle();
    expect(a.data.players).toHaveLength(b.data.players.length);
  });

  it('keeps a change made on the device before the update, and pushes it', async () => {
    const { cloud, a, b } = await skippedOnB('manager');
    cloud.clock.tick(60_000);
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p3' ? { ...p, firstName: 'Mine' } : p)),
    }));
    await b.act((e) => {
      cloud.fail = 'offline';
      return e.runCycle(); // noted with its save time, not pushed
    });
    cloud.fail = null;
    updateApp(b);
    cloud.clock.tick(60_000);
    await b.act((e) => e.syncNow());
    expect(has(b, NEW)).toBe(true);
    expect(cloud.record(T1, 'player', 'p3')?.payload).toMatchObject({ firstName: 'Mine' });
    await a.cycle();
    expect(a.data.players.find((p) => p.id === 'p3')?.firstName).toBe('Mine');
    expect(a.data.players.find((p) => p.id === NEW)?.firstName).toBe('Newer app');
  });

  it('arrives on a view-only device too', async () => {
    const { cloud, b } = await skippedOnB('player');
    updateApp(b);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(has(b, NEW)).toBe(true);
    expect(b.data.sync.teams[T1].role).toBe('player');
    expect(b.data.sync.teams[T1].cursor).toBeGreaterThan(0);
  });
});
