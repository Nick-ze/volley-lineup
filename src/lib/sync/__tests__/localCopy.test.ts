/**
 * v10 audit (docs/AUDIT_V10.md M7, owner's choice: ask first — DECISIONS #334).
 *
 * A team that was unlinked (the account was removed from it, or another account was used) stays
 * on the device as a local copy. Joining the same team again, downloading it or sharing the
 * copy linked the cloud team over that copy without a word: a view-only member got the cloud's
 * version in its place, a manager's copy lost against the cloud wherever both had a record.
 * Whatever had been changed on the copy since was gone.
 *
 * Now nothing links a cloud team over such a copy by itself. Joining still makes the account a
 * member, but leaves the copy alone and says so (`localCopy`); sharing the copy answers
 * `inCloud`; and `downloadTeams` replaces only the copies it is told to (`replaceCopies`: the
 * teams the user agreed to after the question).
 */
import { sliceToRecords, teamSlice, type TeamData } from '@/domain/syncRecords';
import type { TeamRole } from '@/domain/types';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { createEngine } from '../engine';
import { createInvite } from '../memberCommands';
import { downloadTeams, joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, profileId: PROFILE.id, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

const NAME = t1().teams[0].name;

/** An older copy of t1: p1 renamed on it, and a player the team never had. */
function oldCopy(): TeamData {
  const data = t1();
  return {
    ...data,
    players: [
      ...data.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Changed here' } : p)),
      { ...data.players[1], id: 'p-old', number: 88, firstName: 'Only here' },
    ],
  };
}

const records = (d: TestDevice) => {
  const slice = teamSlice(d.data, T1);
  return slice ? Object.fromEntries(sliceToRecords(slice)) : {};
};
const firstName = (d: TestDevice, id: string) => d.data.players.find((p) => p.id === id)?.firstName;
const calls = (cloud: FakeCloud, name: string) => cloud.calls.filter((c) => c === name).length;

/** Anna shares t1 from device A; Ben's device B has an older copy of it; an invite for Ben. */
async function benHasACopy(role: TeamRole) {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b', oldCopy());
  await a.signIn('anna@example.test');
  await b.signIn('ben@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  const invite = await a.act((e) => createInvite(e, T1, role, 7));
  if (!invite.ok) throw new Error('no invite');
  cloud.clock.tick(60_000);
  return { cloud, a, b, code: invite.value.code };
}

describe('joining a team this device has an older copy of (audit M7)', () => {
  it('as a view-only member: the copy stays as it is until the user has agreed', async () => {
    const { cloud, a, b, code } = await benHasACopy('player');
    const before = records(b);
    const joined = await b.act((e) => joinTeam(e, code));
    expect(joined).toEqual({
      ok: true,
      value: { teamId: T1, role: 'player', name: NAME, localCopy: true },
    });
    // A member now — but nothing on the device has changed, and nothing syncs yet.
    expect(cloud.role(T1, cloud.userId('ben@example.test'))).toBe('player');
    for (let i = 0; i < 2; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    expect(b.data.sync.teams).toEqual({});
    expect(records(b)).toEqual(before);
    expect(firstName(b, 'p1')).toBe('Changed here');

    // "Use the cloud version": the copy gives way, as it did without a question before.
    expect(await b.act((e) => downloadTeams(e, [T1], [T1]))).toEqual({ ok: true, value: [] });
    await b.cycle();
    expect(b.data.sync.teams[T1]).toMatchObject({ role: 'player' });
    expect(records(b)).toEqual(records(a));
    expect(b.data.players.some((p) => p.id === 'p-old')).toBe(false);
  });

  it('as a manager: the same; agreed, the cloud wins and what only the copy had is added', async () => {
    const { cloud, a, b, code } = await benHasACopy('manager');
    const before = records(b);
    const joined = await b.act((e) => joinTeam(e, code));
    expect(joined).toMatchObject({ ok: true, value: { role: 'manager', localCopy: true } });
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.data.sync.teams).toEqual({});
    expect(records(b)).toEqual(before);
    expect(cloud.record(T1, 'player', 'p-old')).toBeUndefined();

    await b.act((e) => downloadTeams(e, [T1], [T1]));
    await b.cycle();
    cloud.clock.tick(60_000);
    await a.cycle();
    expect(firstName(b, 'p1')).toBe(firstName(a, 'p1'));
    expect(firstName(b, 'p1')).not.toBe('Changed here');
    expect(cloud.record(T1, 'player', 'p-old')?.deleted).toBe(false);
    expect(a.data.players.some((p) => p.id === 'p-old')).toBe(true);
  });

  it('the same code again while the question is open asks the server nothing more', async () => {
    // A manager code works once: a second request would answer "invalid code".
    const { cloud, b, code } = await benHasACopy('manager');
    const first = await b.act((e) => joinTeam(e, code));
    const asked = calls(cloud, 'joinTeam');
    expect(await b.act((e) => joinTeam(e, code))).toEqual(first);
    expect(calls(cloud, 'joinTeam')).toBe(asked);
    expect(b.data.sync.teams).toEqual({});
    // After the answer, the code says "joined" like any other (the team is linked).
    await b.act((e) => downloadTeams(e, [T1], [T1]));
    expect(await b.act((e) => joinTeam(e, code))).toMatchObject({
      ok: true,
      value: { teamId: T1, role: 'manager', localCopy: false },
    });
    expect(calls(cloud, 'joinTeam')).toBe(asked);
  });

  it('a team that isn’t on the device is downloaded at once, as before', async () => {
    const { a, code } = await benHasACopy('player');
    const cloud = a.cloud;
    const c = new TestDevice(cloud, 'dev-c');
    await c.signIn('cara@example.test');
    const joined = await c.act((e) => joinTeam(e, code));
    expect(joined).toMatchObject({ ok: true, value: { localCopy: false } });
    await c.cycle();
    expect(records(c)).toEqual(records(a));
  });
});

describe('downloading a team this device has an older copy of (audit M7)', () => {
  /** Ben is a member (joined, answered "not now"); a second cloud team of his has no copy. */
  async function memberWithCopy() {
    const setup = await benHasACopy('player');
    await setup.b.act((e) => joinTeam(e, setup.code));
    return setup;
  }

  it('is left alone unless the download names it; the command says which were left', async () => {
    const { cloud, b } = await memberWithCopy();
    const before = records(b);
    expect(await b.act((e) => downloadTeams(e, [T1]))).toEqual({ ok: true, value: [T1] });
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.data.sync.teams).toEqual({});
    expect(records(b)).toEqual(before);
    // Naming another team doesn't cover this one.
    expect(await b.act((e) => downloadTeams(e, [T1], ['other']))).toEqual({
      ok: true,
      value: [T1],
    });
    expect(b.data.sync.teams).toEqual({});
  });

  it('after an app restart the question is still needed, and the answer still works', async () => {
    const { cloud, a, b } = await memberWithCopy();
    const fresh = createEngine(b.backend, { now: () => cloud.clock.ms });
    await b.act(async () => {
      fresh.setSession(b.backend.session);
      await fresh.runCycle();
      expect(await downloadTeams(fresh, [T1])).toEqual({ ok: true, value: [T1] });
    });
    expect(b.data.sync.teams).toEqual({});
    expect(firstName(b, 'p1')).toBe('Changed here');
    await b.act(async () => {
      expect(await downloadTeams(fresh, [T1], [T1])).toEqual({ ok: true, value: [] });
      await fresh.runCycle();
    });
    expect(records(b)).toEqual(records(a));
  });

  it('a team already shared on this device isn’t a copy: nothing to ask', async () => {
    const { a } = await memberWithCopy();
    expect(await a.act((e) => downloadTeams(e, [T1]))).toEqual({ ok: true, value: [] });
    expect(a.data.sync.teams[T1]).toMatchObject({ role: 'manager' });
  });
});

describe('sharing an older copy of a team the account already belongs to (audit M7)', () => {
  it('changes nothing and says the team is in the cloud; the agreed download links it', async () => {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1());
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    cloud.clock.tick(60_000);
    // Anna's second device has an older copy (restored from a backup, say).
    const b = new TestDevice(cloud, 'dev-b', oldCopy());
    await b.signIn('anna@example.test');
    const before = records(b);
    expect(await b.act((e) => uploadTeams(e, [T1]))).toEqual({
      ok: true,
      value: [{ teamId: T1, result: 'inCloud' }],
    });
    await b.cycle();
    expect(b.data.sync.teams).toEqual({});
    expect(records(b)).toEqual(before);
    expect(cloud.record(T1, 'player', 'p-old')).toBeUndefined();

    await b.act((e) => downloadTeams(e, [T1], [T1]));
    await b.cycle();
    expect(b.data.sync.teams[T1]).toMatchObject({ role: 'manager' });
    expect(firstName(b, 'p1')).not.toBe('Changed here');
    expect(cloud.record(T1, 'player', 'p-old')?.deleted).toBe(false);
  });

  it('a team that is already shared on this device still answers "linked"', async () => {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1());
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, [T1]));
    expect(await a.act((e) => uploadTeams(e, [T1]))).toEqual({
      ok: true,
      value: [{ teamId: T1, result: 'linked' }],
    });
  });
});
