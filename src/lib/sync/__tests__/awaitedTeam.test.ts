/**
 * v10 audit (docs/AUDIT_V10.md M6): a linked team whose own record isn't in the cloud (its
 * creator's first save hasn't arrived, or was refused) or can't be read by this app version. The
 * team can't be shown without that record, and the pull cursor doesn't move while it is missing:
 * every cycle used to download the whole team again from the start — every minute, with its
 * photos — for as long as the record stayed away.
 *
 * Now the complete pull is repeated only when the team's own record has changed; in between a
 * cycle only asks for what is new. The user gets a notice, which goes away when the team arrives.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { useAppStore, useSyncRuntime } from '@/store';
import { FakeCloud, type FakeBackend } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import type { PushItem } from '../backend';
import { createInvite } from '../memberCommands';
import { downloadTeams, joinTeam, unlinkTeam } from '../teamCommands';

const T9 = 'team-nine';
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

const golden = (): TeamData => {
  const slice = teamSlice(goldenTeamData(), 't1');
  if (!slice) throw new Error('no t1');
  return { ...slice, teams: [slice.team] };
};

const iso = (ms: number) => new Date(ms).toISOString();

/** The golden team's players as pushed records (two of them have photos). */
function playerItems(at: string): PushItem[] {
  return golden().players.map((p) => {
    const { id, teamId: _teamId, description: _description, ...payload } = p;
    return { kind: 'player' as const, id, at, payload };
  });
}

function teamItem(at: string, name = 'Team Nine'): PushItem {
  const { id: _id, profileId: _profileId, ...payload } = golden().teams[0];
  return { kind: 'team', id: T9, at, payload: { ...payload, name } };
}

/**
 * Anna's cloud team has players (with photos) but no team record: her device created the team,
 * and the save of the team's own record never arrived. Ben joined with a code.
 */
async function joinedWithoutTeamRecord() {
  const cloud = new FakeCloud();
  const anna = cloud.device();
  anna.signInAs('anna@example.test');
  await anna.createTeam(T9, 'Anna');
  await anna.uploadPhoto(T9, 'ph2', PHOTO);
  await anna.uploadPhoto(T9, 'ph3', PHOTO);
  await anna.pushRecords(T9, 'dev-a', playerItems(iso(cloud.clock.ms)));
  const invite = await anna.createInvite(T9, 'player', 7);
  const b = new TestDevice(cloud, 'dev-b');
  await b.signIn('ben@example.test');
  cloud.clock.tick(60_000);
  const joined = await b.act((e) => joinTeam(e, invite.code));
  expect(joined.ok).toBe(true);
  return { cloud, anna, b };
}

interface Pull {
  after: number;
  rows: number;
}

/** Logs what this device pulls from now on. */
function watchPulls(d: TestDevice): Pull[] {
  const pulls: Pull[] = [];
  const pull = d.backend.pullChanges.bind(d.backend);
  d.backend.pullChanges = async (teamId, after, limit) => {
    const page = await pull(teamId, after, limit);
    pulls.push({ after, rows: page.rows.length });
    return page;
  };
  return pulls;
}

const count = (cloud: FakeCloud, name: string) => cloud.calls.filter((c) => c === name).length;
const waitingNotices = (d: TestDevice) => d.runtime.notices.filter((n) => n.kind === 'waiting');

async function saveTeamRecord(cloud: FakeCloud, anna: FakeBackend, name?: string) {
  await anna.pushRecords(T9, 'dev-a', [teamItem(iso(cloud.clock.ms), name)]);
}

describe('a linked team whose own record hasn’t arrived (audit M6)', () => {
  it('isn’t downloaded again from the start every cycle', async () => {
    const { cloud, b } = await joinedWithoutTeamRecord();
    expect(b.data.teams).toEqual([]);
    expect(b.data.sync.teams[T9]).toMatchObject({ role: 'player', cursor: 0, base: {} });
    const pulls = watchPulls(b);
    const photos = count(cloud, 'downloadPhoto');
    for (let i = 0; i < 5; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    // Five cycles: five small "anything new?" requests, no row downloaded again, no photo.
    expect(pulls).toHaveLength(5);
    expect(pulls.reduce((sum, p) => sum + p.rows, 0)).toBe(0);
    expect(pulls.every((p) => p.after > 0)).toBe(true);
    expect(count(cloud, 'downloadPhoto')).toBe(photos);
    // Still linked and waiting; nothing was written for it.
    expect(b.data.sync.teams[T9]).toMatchObject({ role: 'player', cursor: 0, base: {} });
    expect(b.data.teams).toEqual([]);
    expect(b.runtime.status.phase).toBe('synced');
  });

  it('downloads no photos for a team it can’t show', async () => {
    const { cloud, b } = await joinedWithoutTeamRecord();
    expect(count(cloud, 'downloadPhoto')).toBe(0);
    expect(b.photos).toEqual({});
  });

  it('arrives, complete, as soon as its record is saved', async () => {
    const { cloud, anna, b } = await joinedWithoutTeamRecord();
    cloud.clock.tick(60_000);
    await b.cycle();
    cloud.clock.tick(60_000);
    await saveTeamRecord(cloud, anna);
    const pulls = watchPulls(b);
    await b.cycle();
    // The check that found the record, then one complete pull.
    expect(pulls.map((p) => p.after > 0)).toEqual([true, false]);
    expect(b.data.teams.map((t) => t.name)).toEqual(['Team Nine']);
    expect(b.data.players).toHaveLength(golden().players.length);
    expect(b.photos).toEqual({ ph2: PHOTO, ph3: PHOTO });
    expect(b.data.sync.teams[T9].cursor).toBeGreaterThan(0);
    // From here on it syncs like any other team.
    cloud.clock.tick(60_000);
    await anna.pushRecords(T9, 'dev-a', [
      {
        ...playerItems(iso(cloud.clock.ms))[0],
        payload: { ...playerItems('')[0].payload, firstName: 'Later' },
      },
    ]);
    await b.cycle();
    expect(b.data.players.find((p) => p.id === 'p1')?.firstName).toBe('Later');
  });

  it('tells the user, once, and takes the notice back when the team arrives', async () => {
    const { cloud, anna, b } = await joinedWithoutTeamRecord();
    expect(waitingNotices(b)).toEqual([{ kind: 'waiting', teamId: T9, teamName: '' }]);
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    expect(waitingNotices(b)).toHaveLength(1);
    await saveTeamRecord(cloud, anna);
    await b.cycle();
    expect(b.data.teams).toHaveLength(1);
    expect(waitingNotices(b)).toEqual([]);
  });

  it('other records changing don’t cause a complete pull — only the team’s own record does', async () => {
    const { cloud, anna, b } = await joinedWithoutTeamRecord();
    cloud.clock.tick(60_000);
    await b.cycle();
    const pulls = watchPulls(b);
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      const item = playerItems(iso(cloud.clock.ms))[0];
      await anna.pushRecords(T9, 'dev-a', [
        { ...item, payload: { ...item.payload, firstName: `Edit ${i}` } },
      ]);
      await b.cycle();
    }
    expect(pulls.every((p) => p.after > 0 && p.rows <= 1)).toBe(true);
    expect(pulls).toHaveLength(3);
    // The team's record arrives: everything comes, with the latest edit.
    cloud.clock.tick(60_000);
    await saveTeamRecord(cloud, anna);
    await b.cycle();
    expect(b.data.players.find((p) => p.id === 'p1')?.firstName).toBe('Edit 2');
  });

  it('a record this app can’t read is tried again only when it changes', async () => {
    const { cloud, anna, b } = await joinedWithoutTeamRecord();
    cloud.clock.tick(60_000);
    // Saved by another app version: a name this version refuses (over 200 characters).
    await saveTeamRecord(cloud, anna, 'x'.repeat(250));
    await b.cycle(); // the check sees a team record: one complete pull, still unreadable
    const pulls = watchPulls(b);
    for (let i = 0; i < 4; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    // The unreadable record itself is read once more (it was too new to pass); then nothing.
    expect(pulls.map((p) => p.rows)).toEqual([1, 0, 0, 0]);
    expect(pulls.every((p) => p.after > 0)).toBe(true);
    expect(b.data.teams).toEqual([]);
    expect(waitingNotices(b)).toHaveLength(1);
    // No "records skipped" notice without a team name on top of it.
    expect(b.runtime.notices.filter((n) => n.kind === 'skipped')).toEqual([]);
    // The manager shortens the name.
    cloud.clock.tick(60_000);
    await saveTeamRecord(cloud, anna, 'Readable');
    await b.cycle();
    expect(b.data.teams.map((t) => t.name)).toEqual(['Readable']);
  });

  it('stays linked when the cloud team also holds deleted records', async () => {
    const { cloud, anna, b } = await joinedWithoutTeamRecord();
    cloud.clock.tick(60_000);
    await anna.pushRecords(T9, 'dev-a', [
      { kind: 'player', id: 'p5', at: iso(cloud.clock.ms), deleted: true },
    ]);
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    expect(b.data.sync.teams[T9]).toMatchObject({ role: 'player', cursor: 0, base: {} });
    cloud.clock.tick(60_000);
    await saveTeamRecord(cloud, anna);
    await b.cycle();
    expect(b.data.teams).toHaveLength(1);
    expect(b.data.players.some((p) => p.id === 'p5')).toBe(false);
    expect(b.data.players).toHaveLength(golden().players.length - 1);
  });

  it('a team record that commits late, below rows already seen, is still found', async () => {
    const { cloud, anna, b } = await joinedWithoutTeamRecord();
    // Anna's device saves the team record (version N) and, in the same seconds, another record
    // (version N + 1). The second commits first: Ben's check sees N + 1 but not yet N.
    cloud.clock.tick(60_000);
    await saveTeamRecord(cloud, anna);
    const teamRow = cloud.record(T9, 'team', T9);
    if (!teamRow) throw new Error('no team row');
    const item = playerItems(iso(cloud.clock.ms))[0];
    await anna.pushRecords(T9, 'dev-a', [
      { ...item, payload: { ...item.payload, firstName: 'Committed first' } },
    ]);
    const pull = b.backend.pullChanges.bind(b.backend);
    let uncommitted = true;
    b.backend.pullChanges = async (teamId, after, limit) => {
      const page = await pull(teamId, after, limit);
      if (!uncommitted) return page;
      return {
        ...page,
        rows: page.rows.filter((r) => (r as { version: number }).version !== teamRow.version),
      };
    };
    cloud.clock.tick(2000);
    await b.cycle();
    expect(b.data.teams).toEqual([]);
    // It commits; much later Ben's device syncs again.
    uncommitted = false;
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.data.teams).toHaveLength(1);
    expect(b.data.players.find((p) => p.id === 'p1')?.firstName).toBe('Committed first');
  });

  it('survives a restart: the first cycle of a new app run pulls completely once', async () => {
    const { cloud, b } = await joinedWithoutTeamRecord();
    cloud.clock.tick(60_000);
    await b.cycle();
    b.engine.awaited.clear(); // what an app restart forgets
    const pulls = watchPulls(b);
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    expect(pulls.map((p) => p.after > 0)).toEqual([false, true, true]);
  });

  it('"Download" of such a team doesn’t pull it from the start again either', async () => {
    const { cloud, b } = await joinedWithoutTeamRecord();
    cloud.clock.tick(60_000);
    const pulls = watchPulls(b);
    const result = await b.act((e) => downloadTeams(e, [T9]));
    expect(result.ok).toBe(true);
    expect(pulls.reduce((sum, p) => sum + p.rows, 0)).toBe(0);
  });

  it('forgets the team when it is unlinked (removed from the cloud team)', async () => {
    const { cloud, anna, b } = await joinedWithoutTeamRecord();
    await anna.removeMember(T9, cloud.userId('ben@example.test'));
    await b.cycle();
    expect(b.data.sync.teams[T9]).toBeUndefined();
    expect(b.engine.awaited.has(T9)).toBe(false);
    expect(waitingNotices(b)).toEqual([]);
  });
});

describe('a waited-for team whose link goes (from the review of this fix)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** The data of a file that holds the team (as a backup of the manager's would). */
  const importedTeam = (): Parameters<ReturnType<typeof useAppStore.getState>['replaceAll']>[0] => {
    const data = golden();
    const s = useAppStore.getState();
    return {
      profiles: s.profiles,
      teams: [{ ...data.teams[0], id: T9, profileId: PROFILE.id, photoId: undefined }],
      players: data.players.map((p) => ({ ...p, teamId: T9, photoId: undefined })),
      matches: [],
      presets: [],
      seasons: [],
      opponents: [],
    };
  };

  it('during its check: no "can’t be shown yet" notice is left behind', async () => {
    const { cloud, b } = await joinedWithoutTeamRecord();
    expect(waitingNotices(b)).toHaveLength(1);
    cloud.clock.tick(60_000);
    await b.act(async (engine) => {
      const stop = engine.start(); // the running app: the engine listens to the store
      await jest.advanceTimersByTimeAsync(10);
      const pull = b.backend.pullChanges.bind(b.backend);
      let imported = false;
      b.backend.pullChanges = async (teamId, after, limit) => {
        const page = await pull(teamId, after, limit);
        if (!imported) {
          imported = true;
          useAppStore.getState().replaceAll(importedTeam());
        }
        return page;
      };
      await engine.runCycle();
      stop();
      // The import unlinked the team (a link never adopts an imported team); it is an ordinary
      // local team now, and nothing says it is still waited for.
      expect(useAppStore.getState().sync.teams[T9]).toBeUndefined();
      expect(useAppStore.getState().teams.map((t) => t.id)).toEqual([T9]);
      expect(useSyncRuntime.getState().notices.filter((n) => n.kind === 'waiting')).toEqual([]);
      expect(engine.awaited.has(T9)).toBe(false);
    });
  });

  it('during its first complete pull: not remembered as waited for', async () => {
    const { cloud, b } = await joinedWithoutTeamRecord();
    b.engine.awaited.clear(); // a new app run: the next pull is a complete one
    cloud.clock.tick(60_000);
    await b.act(async (engine) => {
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(10);
      const pull = b.backend.pullChanges.bind(b.backend);
      b.backend.pullChanges = async (teamId, after, limit) => {
        const page = await pull(teamId, after, limit);
        if (useAppStore.getState().sync.teams[T9]) useAppStore.getState().resetAll();
        return page;
      };
      await engine.runCycle();
      stop();
      expect(engine.awaited.has(T9)).toBe(false);
      expect(useSyncRuntime.getState().notices.filter((n) => n.kind === 'waiting')).toEqual([]);
    });
  });

  it('"Stop syncing on this device" (unlink) takes the notice and the memory with it', async () => {
    const { b } = await joinedWithoutTeamRecord();
    expect(waitingNotices(b)).toHaveLength(1);
    expect(b.engine.awaited.has(T9)).toBe(true);
    await b.act((engine) => unlinkTeam(engine, T9));
    expect(b.data.sync.teams[T9]).toBeUndefined();
    expect(b.engine.awaited.has(T9)).toBe(false);
    expect(waitingNotices(b)).toEqual([]);
  });

  it('a link removed by the store (e.g. "Delete all data") does the same in the running app', async () => {
    const { b } = await joinedWithoutTeamRecord();
    await b.act(async (engine) => {
      const stop = engine.start();
      await jest.advanceTimersByTimeAsync(10);
      expect(engine.awaited.has(T9)).toBe(true);
      useAppStore.getState().resetAll();
      expect(engine.awaited.has(T9)).toBe(false);
      expect(useSyncRuntime.getState().notices.filter((n) => n.kind === 'waiting')).toEqual([]);
      stop();
    });
  });

  it('only that team’s "can’t be shown yet" notice goes: other notices stay', async () => {
    const { b } = await joinedWithoutTeamRecord();
    const other = { kind: 'waiting' as const, teamId: 'another-team', teamName: '' };
    const skipped = { kind: 'skipped' as const, teamId: T9, teamName: '', count: 2 };
    b.runtime = { ...b.runtime, notices: [...b.runtime.notices, other, skipped] };
    await b.act((engine) => unlinkTeam(engine, T9));
    expect(b.runtime.notices).toEqual([other, skipped]);
  });
});

describe('a manager’s new team on a second device, before the first device has pushed', () => {
  it('appears on the second device once the first one syncs', async () => {
    // The same account on two devices: device A shares the team while offline right after
    // `create_team` (its records wait); device B already lists and downloads the team.
    const cloud = new FakeCloud();
    const anna = cloud.device();
    anna.signInAs('anna@example.test');
    await anna.createTeam(T9, 'Anna');
    const b = new TestDevice(cloud, 'dev-b');
    await b.signIn('anna@example.test');
    await b.act((e) => downloadTeams(e, [T9]));
    await b.cycle();
    expect(b.data.teams).toEqual([]);
    expect(b.data.sync.teams[T9]).toMatchObject({ role: 'manager', cursor: 0 });
    cloud.clock.tick(60_000);
    await anna.pushRecords(T9, 'dev-a', [
      teamItem(iso(cloud.clock.ms)),
      ...playerItems(iso(cloud.clock.ms)),
    ]);
    await b.cycle();
    expect(b.data.teams).toHaveLength(1);
    expect(b.data.sync.teams[T9].role).toBe('manager');
    // Nothing of the downloaded team is pushed back.
    expect(b.runtime.status.pending).toBe(0);
    const invite = await b.act((e) => createInvite(e, T9, 'player', 7));
    expect(invite.ok).toBe(true);
  });
});
