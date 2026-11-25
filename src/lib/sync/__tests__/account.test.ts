/**
 * v10 sync engine: sign-in, the first upload (created / linked / rekeyed), the cloud team list,
 * account switch, sign-out, deleting the account and deleting / leaving a shared team.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { FakeCloud, FAKE_CODE } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import {
  accountDeletionCheck,
  deleteAccount,
  linkAccountToProfile,
  requestCode,
  verifyCode,
} from '../accountCommands';
import { createEngine } from '../engine';
import { createInvite } from '../memberCommands';
import {
  deleteTeamEverywhere,
  downloadTeams,
  joinTeam,
  leaveTeam,
  listCloudTeams,
  unlinkTeam,
  uploadTeams,
} from '../teamCommands';

const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), 't1');
  if (!slice) throw new Error('no t1');
  return { ...slice, teams: [slice.team] };
}

function device(cloud: FakeCloud, name: string, data: Partial<TeamData> = t1()): TestDevice {
  const d = new TestDevice(cloud, name, data);
  d.photos = { ph2: PHOTO, ph3: PHOTO };
  return d;
}

describe('sign-in', () => {
  it('sends a code, verifies it and sets the session (no account link yet)', async () => {
    const cloud = new FakeCloud();
    const d = device(cloud, 'dev-a');
    expect(await d.act((e) => requestCode(e, ' anna@example.test '))).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await d.act((e) => verifyCode(e, 'anna@example.test', '000000'))).toEqual({
      ok: false,
      error: 'invalidCode',
    });
    const ok = await d.act((e) => verifyCode(e, 'anna@example.test', FAKE_CODE));
    expect(ok).toEqual({
      ok: true,
      value: { userId: cloud.userId('anna@example.test'), switchedFrom: null },
    });
    expect(d.runtime.session).toEqual({
      userId: cloud.userId('anna@example.test'),
      email: 'anna@example.test',
    });
    expect(d.data.sync.account).toBeNull();
    await d.act((e) => linkAccountToProfile(e, PROFILE.id));
    expect(d.data.sync.account).toEqual({
      userId: cloud.userId('anna@example.test'),
      email: 'anna@example.test',
      profileId: PROFILE.id,
    });
  });

  it('another account: says so with the pending count; linking unlinks the old teams', async () => {
    const cloud = new FakeCloud();
    const d = device(cloud, 'dev-a');
    await d.signIn('anna@example.test');
    await d.act((e) => uploadTeams(e, ['t1']));
    await d.act((e) => e.runCycle());
    await d.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Pending' } : p)),
    }));
    await d.act((e) => e.signOut());
    const result = await d.act((e) => verifyCode(e, 'ben@example.test', FAKE_CODE));
    expect(result).toEqual({
      ok: true,
      value: {
        userId: cloud.userId('ben@example.test'),
        switchedFrom: { email: 'anna@example.test', pending: 1 },
      },
    });
    expect(d.data.sync.teams.t1).toBeDefined();
    await d.act((e) => linkAccountToProfile(e, PROFILE.id));
    expect(d.data.sync.teams).toEqual({});
    expect(d.data.teams.map((t) => t.id)).toEqual(['t1']);
    expect(d.data.sync.account?.email).toBe('ben@example.test');
  });

  it('without a session linking does nothing', async () => {
    const d = device(new FakeCloud(), 'dev-a');
    await d.act((e) => linkAccountToProfile(e, PROFILE.id));
    expect(d.data.sync.account).toBeNull();
  });
});

describe('first upload', () => {
  it("'created': linked as manager and pushed, photos included", async () => {
    const cloud = new FakeCloud();
    const d = device(cloud, 'dev-a');
    await d.signIn('anna@example.test');
    const result = await d.act(async (e) => {
      const r = await uploadTeams(e, ['t1']);
      await e.runCycle();
      return r;
    });
    expect(result).toEqual({ ok: true, value: [{ teamId: 't1', result: 'created' }] });
    expect(d.data.sync.teams.t1).toMatchObject({ role: 'manager', edits: {} });
    expect(cloud.record('t1', 'team', 't1')?.payload).toMatchObject({ name: 'Herren 1 – Süd' });
    expect([...cloud.photos.keys()].sort()).toEqual(['t1/ph2', 't1/ph3']);
    expect(d.data.sync.teams.t1.photos.sort()).toEqual(['ph2', 'ph3']);
  });

  it("'linked': the account already has the team — the cloud wins, local-only records go up", async () => {
    const cloud = new FakeCloud();
    const a = device(cloud, 'dev-a');
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    cloud.clock.tick(1000);
    // Device B has an older copy of t1 (another name) plus a player the cloud lacks.
    const b = device(cloud, 'dev-b', {
      ...t1(),
      teams: [{ ...t1().teams[0], name: 'Old name' }],
      players: [...t1().players, { ...t1().players[1], id: 'p-new', number: 77 }],
    });
    await b.signIn('anna@example.test');
    const result = await b.act((e) => uploadTeams(e, ['t1']));
    expect(result).toEqual({ ok: true, value: [{ teamId: 't1', result: 'linked' }] });
    await b.cycle();
    expect(b.data.teams[0].name).toBe('Herren 1 – Süd');
    expect(cloud.record('t1', 'player', 'p-new')).toBeDefined();
    await a.cycle();
    expect(a.data.players.some((p) => p.id === 'p-new')).toBe(true);
  });

  it("'rekeyed': the id is someone else's — a new id here, then created (newTeamId)", async () => {
    const cloud = new FakeCloud();
    const other = device(cloud, 'dev-x');
    await other.signIn('other@example.test');
    await other.act((e) => uploadTeams(e, ['t1']));
    const d = device(cloud, 'dev-a');
    await d.signIn('anna@example.test');
    const result = await d.act((e) => uploadTeams(e, ['t1']));
    expect(result.ok).toBe(true);
    const item = result.ok ? result.value[0] : null;
    expect(item).toMatchObject({ teamId: 't1', result: 'rekeyed', newTeamId: expect.any(String) });
    const newId = item?.newTeamId as string;
    expect(newId).not.toBe('t1');
    expect(d.data.teams.map((t) => t.id)).toEqual([newId]);
    expect(d.data.players.every((p) => p.teamId === newId)).toBe(true);
    expect(d.data.sync.teams[newId]).toMatchObject({ role: 'manager' });
    expect(cloud.role(newId, cloud.userId('anna@example.test'))).toBe('manager');
  });

  it('an id the server would refuse is rekeyed first', async () => {
    const cloud = new FakeCloud();
    const data = t1();
    const bad = 'team/with%slash';
    const d = device(cloud, 'dev-a', {
      ...data,
      teams: [{ ...data.teams[0], id: bad }],
      players: data.players.map((p) => ({ ...p, teamId: bad })),
      seasons: data.seasons.map((x) => ({ ...x, teamId: bad })),
      matches: data.matches.map((m) => ({ ...m, teamId: bad })),
      presets: data.presets.map((p) => ({ ...p, teamId: bad })),
    });
    await d.signIn('anna@example.test');
    const result = await d.act((e) => uploadTeams(e, [bad]));
    const item = result.ok ? result.value[0] : null;
    expect(item).toMatchObject({ teamId: bad, result: 'rekeyed' });
    expect(cloud.teams.has(item?.newTeamId as string)).toBe(true);
  });

  it('the create fails after the team got a new id: failed, but with newTeamId', async () => {
    const cloud = new FakeCloud();
    const other = device(cloud, 'dev-x');
    await other.signIn('other@example.test');
    await other.act((e) => uploadTeams(e, ['t1']));
    const d = device(cloud, 'dev-a');
    await d.signIn('anna@example.test');
    const create = d.backend.createTeam.bind(d.backend);
    let calls = 0;
    d.backend.createTeam = async (id, name) => {
      calls += 1;
      if (calls === 2) throw new TypeError('Network request failed');
      return create(id, name);
    };
    const result = await d.act((e) => uploadTeams(e, ['t1']));
    const item = result.ok ? result.value[0] : null;
    expect(item).toMatchObject({ teamId: 't1', result: 'failed', error: 'offline' });
    expect(item?.newTeamId).toEqual(expect.any(String));
    expect(d.data.teams.map((t) => t.id)).toEqual([item?.newTeamId]);
    expect(d.data.sync.teams).toEqual({});
  });

  it('failures: a missing team fails; 10 created teams is tooMany; offline ends the command', async () => {
    const cloud = new FakeCloud();
    const d = device(cloud, 'dev-a');
    await d.signIn('anna@example.test');
    const anna = cloud.userId('anna@example.test');
    for (let i = 0; i < 10; i += 1) {
      cloud.teams.set(`x${i}`, {
        createdBy: anna,
        members: new Map(),
        records: new Map(),
        removals: new Map(),
      });
    }
    expect(await d.act((e) => uploadTeams(e, ['nope', 't1']))).toEqual({
      ok: true,
      value: [
        { teamId: 'nope', result: 'failed', error: 'unknown' },
        { teamId: 't1', result: 'failed', error: 'tooMany' },
      ],
    });
    cloud.fail = 'offline';
    expect(await d.act((e) => uploadTeams(e, ['t1']))).toEqual({ ok: false, error: 'offline' });
  });
});

describe('cloud teams', () => {
  it('lists the account’s teams with names, roles and whether they are here; downloads', async () => {
    const cloud = new FakeCloud();
    const a = device(cloud, 'dev-a');
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    const b = device(cloud, 'dev-b', {});
    await b.signIn('anna@example.test');
    expect(await b.act((e) => listCloudTeams(e))).toEqual({
      ok: true,
      value: [{ teamId: 't1', name: 'Herren 1 – Süd', role: 'manager', onDevice: false }],
    });
    await b.act((e) => downloadTeams(e, ['t1', 'unknown']));
    expect(b.data.teams.map((t) => [t.id, t.profileId])).toEqual([['t1', PROFILE.id]]);
    expect(Object.keys(b.data.sync.teams)).toEqual(['t1']);
    const listed = await b.act((e) => listCloudTeams(e));
    expect(listed.ok && listed.value[0].onDevice).toBe(true);
  });

  it('a viewer adopting an old local copy gets the cloud copy, also after a restart', async () => {
    const cloud = new FakeCloud();
    const a = device(cloud, 'dev-a');
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    const invite = await a.act((e) => createInvite(e, 't1', 'player', 7));
    // Ben has an old local copy of t1 with a player the cloud doesn't have.
    const old = t1();
    const b = device(cloud, 'dev-b', {
      ...old,
      players: [...old.players, { ...old.players[1], id: 'p-old', number: 88 }],
    });
    await b.signIn('ben@example.test');
    const pull = b.backend.pullChanges.bind(b.backend);
    b.backend.pullChanges = async () => {
      throw new TypeError('Network request failed');
    };
    await b.act((e) => joinTeam(e, invite.ok ? invite.value.code : ''));
    expect(b.data.sync.teams.t1).toMatchObject({ role: 'player', cursor: 0 });
    b.backend.pullChanges = pull;
    // A restart: a new engine, nothing in memory.
    const fresh = createEngine(b.backend, { now: () => cloud.clock.ms });
    await b.act(async () => {
      fresh.setSession(b.backend.session);
      await fresh.runCycle();
    });
    expect(b.data.players.some((p) => p.id === 'p-old')).toBe(false);
    expect(b.data.players.map((p) => p.id).sort()).toEqual(a.data.players.map((p) => p.id).sort());
  });

  it('unlinkTeam keeps the local copy and stops syncing it', async () => {
    const cloud = new FakeCloud();
    const a = device(cloud, 'dev-a');
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.act((e) => unlinkTeam(e, 't1'));
    expect(a.data.sync.teams).toEqual({});
    expect(a.data.teams).toHaveLength(1);
  });
});

describe('leaving and deleting', () => {
  async function sharedWithBen() {
    const cloud = new FakeCloud();
    const a = device(cloud, 'dev-a');
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    const invite = await a.act((e) => createInvite(e, 't1', 'player', 7));
    const b = device(cloud, 'dev-b', {});
    await b.signIn('ben@example.test');
    await b.act((e) => joinTeam(e, invite.ok ? invite.value.code : ''));
    await b.cycle();
    return { cloud, a, b };
  }

  it('leave: the server first, then unlinked and removed here', async () => {
    const { cloud, b } = await sharedWithBen();
    expect(await b.act((e) => leaveTeam(e, 't1'))).toEqual({ ok: true, value: undefined });
    expect(b.data.teams).toEqual([]);
    expect(b.data.sync.teams).toEqual({});
    expect(cloud.role('t1', cloud.userId('ben@example.test'))).toBeNull();
  });

  it('the last manager can’t leave (lastManager); the only member can’t (lastMember)', async () => {
    const { a } = await sharedWithBen();
    expect(await a.act((e) => leaveTeam(e, 't1'))).toEqual({ ok: false, error: 'lastManager' });
    const cloud = new FakeCloud();
    const solo = device(cloud, 'dev-s');
    await solo.signIn('solo@example.test');
    await solo.act((e) => uploadTeams(e, ['t1']));
    expect(await solo.act((e) => leaveTeam(e, 't1'))).toEqual({ ok: false, error: 'lastMember' });
    expect(solo.data.teams).toHaveLength(1);
  });

  it('delete for everyone: photos first, then the team, then here too; others are unlinked', async () => {
    const { cloud, a, b } = await sharedWithBen();
    const mark = cloud.calls.length;
    expect(await a.act((e) => deleteTeamEverywhere(e, 't1'))).toEqual({
      ok: true,
      value: undefined,
    });
    const calls = cloud.calls.slice(mark);
    expect(calls.indexOf('removePhotos')).toBeLessThan(calls.indexOf('deleteTeam'));
    expect(cloud.teams.has('t1')).toBe(false);
    expect(cloud.photoCount('t1')).toBe(0);
    expect(a.data.teams).toEqual([]);
    await b.cycle();
    expect(b.data.sync.teams).toEqual({});
    expect(b.data.teams).toHaveLength(1);
    expect(b.runtime.notices[0]).toMatchObject({ kind: 'removed', teamId: 't1' });
  });

  it('delete for everyone offline: needs a connection, nothing changes here', async () => {
    const { cloud, a } = await sharedWithBen();
    cloud.fail = 'offline';
    expect(await a.act((e) => deleteTeamEverywhere(e, 't1'))).toEqual({
      ok: false,
      error: 'offline',
    });
    expect(a.data.teams).toHaveLength(1);
    expect(a.data.sync.teams.t1).toBeDefined();
  });
});

describe('deleting the account', () => {
  it('lists blocked teams; deleting is refused while there are any', async () => {
    const cloud = new FakeCloud();
    const a = device(cloud, 'dev-a');
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    const invite = await a.act((e) => createInvite(e, 't1', 'player', 7));
    const b = device(cloud, 'dev-b', {});
    await b.signIn('ben@example.test');
    await b.act((e) => joinTeam(e, invite.ok ? invite.value.code : ''));
    expect(await a.act((e) => accountDeletionCheck(e))).toEqual({
      ok: true,
      value: { deleteTeams: [], blockedTeams: ['t1'] },
    });
    expect(await a.act((e) => deleteAccount(e))).toEqual({ ok: false, error: 'lastManager' });
  });

  it('removes the photos of its teams first, then the account; local data stays', async () => {
    const cloud = new FakeCloud();
    const a = device(cloud, 'dev-a');
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    expect(cloud.photoCount('t1')).toBe(2);
    const mark = cloud.calls.length;
    expect(await a.act((e) => deleteAccount(e))).toEqual({ ok: true, value: undefined });
    const calls = cloud.calls.slice(mark);
    expect(calls).toEqual([
      'deletionCheck',
      'listPhotos',
      'removePhotos',
      'deleteAccount',
      'signOut',
    ]);
    expect(cloud.teams.size).toBe(0);
    expect(cloud.photos.size).toBe(0);
    expect(a.data.sync).toMatchObject({ account: null, teams: {} });
    expect(a.runtime.session).toBeNull();
    expect(a.data.teams).toHaveLength(1);
    expect(a.data.players.length).toBeGreaterThan(0);
  });

  it('photos left over (VL008): cleans up again and retries once', async () => {
    const cloud = new FakeCloud();
    const a = device(cloud, 'dev-a');
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    const backend = a.backend;
    const realRemove = backend.removePhotos.bind(backend);
    let first = true;
    backend.removePhotos = async (teamId, ids) => {
      if (first) {
        first = false; // e.g. another device uploaded meanwhile: nothing removed this time
        cloud.calls.push('removePhotos');
        return;
      }
      await realRemove(teamId, ids);
    };
    expect(await a.act((e) => deleteAccount(e))).toEqual({ ok: true, value: undefined });
    expect(cloud.photos.size).toBe(0);
  });
});
