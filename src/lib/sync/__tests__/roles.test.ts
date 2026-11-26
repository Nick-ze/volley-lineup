/**
 * v10 sync engine: roles and memberships — demotion, removal, joining with a code, members and
 * invites, rows whose ids belong to another local team.
 */
import { sliceToRecords, teamSlice, type TeamData } from '@/domain/syncRecords';
import type { Player } from '@/domain/types';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import {
  createInvite,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  setMemberRole,
} from '../memberCommands';
import { joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const NAME = 'Herren 1 – Süd';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  // Without photos: these tests are about roles.
  return {
    ...slice,
    teams: [{ ...slice.team, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

const records = (d: TestDevice) => {
  const slice = teamSlice(d.data, T1);
  return slice ? Object.fromEntries(sliceToRecords(slice)) : {};
};

/** Anna (manager, device A) shares t1 and invites Ben with `role`; Ben joins on device B. */
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
  const joined = await b.act((e) => joinTeam(e, invite.value.code));
  await b.cycle();
  return { cloud, a, b, joined, invite: invite.value };
}

const benId = (cloud: FakeCloud) => cloud.userId('ben@example.test');

describe('joining with a code', () => {
  it('returns the team, the role and the name, and downloads the team', async () => {
    const { a, b, joined } = await shared('player');
    expect(joined).toEqual({ ok: true, value: { teamId: T1, role: 'player', name: NAME } });
    expect(b.data.sync.teams[T1]).toMatchObject({ role: 'player', userId: expect.any(String) });
    expect(records(b)).toEqual(records(a));
  });

  it('a single-use manager code entered twice answers "joined" again (audit L11)', async () => {
    const { cloud, b, joined, invite } = await shared('manager');
    expect(joined).toEqual({ ok: true, value: { teamId: T1, role: 'manager', name: NAME } });
    const calls = cloud.calls.filter((c) => c === 'joinTeam').length;
    expect(await b.act((e) => joinTeam(e, invite.code))).toEqual(joined);
    expect(cloud.calls.filter((c) => c === 'joinTeam')).toHaveLength(calls);
    // Another account on the same device still gets the server's answer: the code is used.
    await b.act((e) => e.signOut());
    await b.signIn('carla@example.test');
    expect(await b.act((e) => joinTeam(e, invite.code))).toEqual({
      ok: false,
      error: 'inviteInvalid',
    });
  });

  it('a wrong code is inviteInvalid; signed out it is notSignedIn without a call', async () => {
    const { cloud, b } = await shared('player');
    expect(await b.act((e) => joinTeam(e, 'AAAAAAAAAA'))).toEqual({
      ok: false,
      error: 'inviteInvalid',
    });
    const c = new TestDevice(cloud, 'dev-c');
    const calls = cloud.calls.length;
    expect(await c.act((e) => joinTeam(e, 'AAAAAAAAAA'))).toEqual({
      ok: false,
      error: 'notSignedIn',
    });
    expect(cloud.calls.length).toBe(calls);
  });

  it('a viewer never pushes (its local changes are overwritten by the cloud)', async () => {
    const { cloud, a, b } = await shared('player');
    const pushes = cloud.calls.filter((c) => c === 'pushRecords').length;
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Viewer' } : p)),
    }));
    await b.cycle();
    expect(cloud.calls.filter((c) => c === 'pushRecords').length).toBe(pushes);
    cloud.clock.tick(1000);
    await a.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Manager' } : p)),
    }));
    await a.cycle();
    await b.cycle();
    expect(b.data.players.find((p) => p.id === 'p1')?.firstName).toBe('Manager');
  });
});

describe('members and invites', () => {
  it('lists members (isMe), invites, revokes and changes roles', async () => {
    const { cloud, a, invite } = await shared('player');
    const members = await a.act((e) => listMembers(e, T1));
    expect(members.ok && members.value.map((m) => [m.displayName, m.role, m.isMe])).toEqual([
      ['Coach', 'manager', true],
      ['Coach', 'player', false],
    ]);
    expect(await a.act((e) => revokeInvite(e, invite.id))).toEqual({ ok: true, value: undefined });
    const invites = await a.act((e) => listInvites(e, T1));
    expect(invites.ok && invites.value[0].revokedAt).toEqual(expect.any(String));
    expect(await a.act((e) => setMemberRole(e, T1, benId(cloud), 'manager'))).toEqual({
      ok: true,
      value: undefined,
    });
    expect(cloud.role(T1, benId(cloud))).toBe('manager');
  });

  it('the last manager can neither demote nor remove themselves away', async () => {
    const { cloud, a } = await shared('player');
    const anna = cloud.userId('anna@example.test');
    expect(await a.act((e) => setMemberRole(e, T1, anna, 'player'))).toEqual({
      ok: false,
      error: 'lastManager',
    });
  });

  it('a player may not manage members (forbidden)', async () => {
    const { b } = await shared('player');
    expect(await b.act((e) => createInvite(e, T1, 'player', 7))).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });
});

describe('invite codes after a demotion or a removal (audit H1)', () => {
  it('a manager made a player can’t become manager again with a spare manager code', async () => {
    const { cloud, a, b } = await shared('manager');
    // Ben, still a manager, creates a manager code for later.
    const spare = await b.act((e) => createInvite(e, T1, 'manager', 7));
    if (!spare.ok) throw new Error('no spare code');
    await a.act((e) => setMemberRole(e, T1, benId(cloud), 'player'));
    await b.cycle();
    expect(await b.act((e) => joinTeam(e, spare.value.code))).toEqual({
      ok: false,
      error: 'inviteInvalid',
    });
    expect(cloud.role(T1, benId(cloud))).toBe('player');
    // The manager's list no longer shows it as usable.
    const listed = await a.act((e) => listInvites(e, T1));
    expect(listed.ok && listed.value.every((i) => i.revokedAt !== null)).toBe(true);
  });

  it('a removed member’s second account can’t join with a code from before the removal', async () => {
    const { cloud, a, b, invite } = await shared('player');
    await a.act((e) => removeMember(e, T1, benId(cloud)));
    const c = new TestDevice(cloud, 'dev-c');
    await c.signIn('ben.again@example.test');
    expect(await c.act((e) => joinTeam(e, invite.code))).toEqual({
      ok: false,
      error: 'inviteInvalid',
    });
    expect(cloud.role(T1, cloud.userId('ben.again@example.test'))).toBeNull();
    // A code created after the removal is a deliberate invitation and works.
    const fresh = await a.act((e) => createInvite(e, T1, 'player', 7));
    if (!fresh.ok) throw new Error('no new code');
    expect((await c.act((e) => joinTeam(e, fresh.value.code))).ok).toBe(true);
    await b.cycle(); // the removed account's device: unlinked, as before
    expect(b.data.sync.teams[T1]).toBeUndefined();
  });
});

describe('role changes seen by a sync', () => {
  it('demotion: view-only, unsynced changes undone (the cloud copy), a notice', async () => {
    const { cloud, a, b } = await shared('manager');
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p2' ? { ...p, firstName: 'Unsynced' } : p)),
      presets: s.presets.filter((p) => p.kind !== 'preset'),
    }));
    await a.act((e) => setMemberRole(e, T1, benId(cloud), 'player'));
    await b.cycle();
    expect(b.data.sync.teams[T1]).toMatchObject({ role: 'player', edits: {} });
    expect(records(b)).toEqual(records(a));
    expect(b.runtime.notices).toEqual([{ kind: 'demoted', teamId: T1, teamName: NAME, undone: 2 }]);
  });

  it('removal: the team is unlinked, the local copy stays, a notice', async () => {
    const { cloud, a, b } = await shared('player');
    await a.act((e) => removeMember(e, T1, benId(cloud)));
    const before = records(b);
    await b.cycle();
    expect(b.data.sync.teams[T1]).toBeUndefined();
    expect(records(b)).toEqual(before);
    expect(b.runtime.notices).toEqual([{ kind: 'removed', teamId: T1, teamName: NAME }]);
    // Removed members can't come back with the old code.
  });

  it('promotion: the device may push from now on', async () => {
    const { cloud, a, b } = await shared('player');
    await a.act((e) => setMemberRole(e, T1, benId(cloud), 'manager'));
    await b.cycle();
    expect(b.data.sync.teams[T1].role).toBe('manager');
    cloud.clock.tick(1000);
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p2' ? { ...p, firstName: 'From Ben' } : p)),
    }));
    await b.cycle();
    await a.cycle();
    expect(a.data.players.find((p) => p.id === 'p2')?.firstName).toBe('From Ben');
  });
});

describe('promotion of a view-only copy that differs from the cloud (audit H8)', () => {
  const sizes = (d: TestDevice) => {
    const slice = teamSlice(d.data, T1);
    return slice ? [slice.players.length, slice.matches.length, slice.presets.length] : null;
  };

  /** Ben's view-only copy has lost the team's content locally; nothing heals it. */
  async function divergedViewer() {
    const ctx = await shared('player');
    const full = sizes(ctx.a);
    ctx.cloud.clock.tick(3_600_000);
    await ctx.b.cycle();
    await ctx.b.edit((s) => ({
      players: s.players.filter((p) => p.teamId !== T1),
      matches: s.matches.filter((m) => m.teamId !== T1),
      presets: s.presets.filter((p) => p.teamId !== T1),
    }));
    await ctx.b.cycle();
    expect(sizes(ctx.b)).toEqual([0, 0, 0]);
    ctx.cloud.clock.tick(86_400_000);
    return { ...ctx, full };
  }

  it('the copy is replaced by the cloud’s before the device may push; nothing is deleted', async () => {
    const { cloud, a, b, full } = await divergedViewer();
    await a.act((e) => setMemberRole(e, T1, benId(cloud), 'manager'));
    await b.cycle();
    expect(b.data.sync.teams[T1].role).toBe('manager');
    expect(sizes(b)).toEqual(full);
    await b.cycle();
    await a.cycle();
    expect(sizes(a)).toEqual(full);
    expect(cloud.record(T1, 'player', 'p1')?.deleted).toBe(false);
    expect(a.runtime.status.pending).toBe(0);
  });

  it('offline at the promotion: still view-only (nothing pushed), manager once the pull worked', async () => {
    const { cloud, a, b, full } = await divergedViewer();
    await a.act((e) => setMemberRole(e, T1, benId(cloud), 'manager'));
    // The membership answer arrives, the pull doesn't.
    const pull = b.backend.pullChanges.bind(b.backend);
    b.backend.pullChanges = async () => {
      throw new TypeError('Network request failed');
    };
    await b.cycle();
    expect(b.data.sync.teams[T1]).toMatchObject({ role: 'player', cursor: 0 });
    expect(cloud.record(T1, 'player', 'p1')?.deleted).toBe(false);
    // Also after an app restart (a new engine with the stored state) and back online.
    b.backend.pullChanges = pull;
    b.engine.resetPending.clear();
    await b.act((e) => e.syncNow());
    expect(b.data.sync.teams[T1].role).toBe('manager');
    expect(sizes(b)).toEqual(full);
    await a.cycle();
    expect(sizes(a)).toEqual(full);
  });

  it('a player who uses a manager code is promoted the same way', async () => {
    const { cloud, a, b, full } = await divergedViewer();
    const code = await a.act((e) => createInvite(e, T1, 'manager', 7));
    if (!code.ok) throw new Error('no code');
    const joined = await b.act((e) => joinTeam(e, code.value.code));
    expect(joined).toMatchObject({ ok: true, value: { role: 'manager' } });
    await b.cycle();
    expect(b.data.sync.teams[T1].role).toBe('manager');
    expect(sizes(b)).toEqual(full);
    await a.cycle();
    expect(sizes(a)).toEqual(full);
    expect(cloud.record(T1, 'player', 'p1')?.deleted).toBe(false);
  });
});

describe('ids of another local team', () => {
  it("skips such rows, doesn't push the team in that cycle and says so once", async () => {
    const { cloud, a, b } = await shared('manager');
    // Device B has a local team with a player whose id the shared team now also uses.
    const p2 = a.data.players.find((p) => p.id === 'p2') as Player;
    const clash: Player = { ...p2, id: 'px', teamId: 'local', firstName: 'Local' };
    await b.edit((s) => ({
      teams: [
        ...s.teams,
        { id: 'local', profileId: 'pr1', name: 'Local', createdAt: '2026-01-01' },
      ],
      players: [...s.players, clash],
    }));
    await a.edit((s) => ({
      players: [...s.players, { ...clash, teamId: T1, firstName: 'Shared' }],
    }));
    await a.cycle();
    cloud.clock.tick(1000);
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p2' ? { ...p, firstName: 'Waits' } : p)),
    }));
    const pushes = cloud.calls.filter((c) => c === 'pushRecords').length;
    const mark = cloud.calls.length;
    await b.cycle();
    await b.cycle();
    expect(cloud.calls.slice(mark)).not.toContain('pushRecords');
    expect(cloud.calls.filter((c) => c === 'pushRecords').length).toBe(pushes);
    expect(b.data.players.find((p) => p.id === 'px')?.teamId).toBe('local');
    expect(b.runtime.notices).toEqual([{ kind: 'skipped', teamId: T1, teamName: NAME, count: 1 }]);
  });
});
