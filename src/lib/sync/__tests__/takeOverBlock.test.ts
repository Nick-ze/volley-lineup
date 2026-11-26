/**
 * v10 audit (docs/AUDIT_V10.md M1): once another device has taken over scoring, the previous
 * scorer's device stops saving that match. Before, it learned about the take-over only at the
 * end of its next sync, after pushing: a rally it scored in between was saved with a later time
 * and replaced the whole set on the server, the new scorer's rallies included.
 *
 * Now a sync reads the holds first. While the other device's hold lasts, the match and its sets
 * aren't pushed from here, and whatever the scorer saves for them replaces this device's unsynced
 * changes (with a notice), whatever the clocks say. Changes the scorer never saved over wait and
 * are synced when the hold ends. A device that never held the match is not affected.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import type { SetEvent } from '@/domain/types';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import type { PushItem } from '../backend';
import { BackendError } from '../errors';
import { holdMatch, releaseMatch } from '../holdCommands';
import { createInvite } from '../memberCommands';
import { joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const M = 'm2';
const SET = `${M}/1`;

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

const TEAM_NAME = t1().teams[0].name;

/** Two managers of the shared team t1 on two devices (A's clock can run ahead). */
async function twoManagers(skewMs = 0) {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1(), { skewMs });
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('ben@example.test');
  // The holder's name is the device's profile name: A is "Coach", B is "Ben".
  await b.edit((x) => ({ profiles: x.profiles.map((p) => ({ ...p, name: 'Ben' })) }));
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  const invite = await a.act((e) => createInvite(e, T1, 'manager', 7));
  if (!invite.ok) throw new Error('no invite');
  await b.act((e) => joinTeam(e, invite.value.code));
  await b.cycle();
  return { cloud, a, b };
}

type Winner = 'us' | 'them';

const winners = (events: readonly SetEvent[] | undefined): Winner[] =>
  (events ?? []).flatMap((e) => (e.type === 'point' ? [e.winner] : []));

/** Who won each rally of set 1, on a device. */
const rallies = (d: TestDevice): Winner[] =>
  winners(d.data.matches.find((m) => m.id === M)?.sets[0]?.events);

/** Who won each rally of set 1, on the server. */
const cloudRallies = (cloud: FakeCloud): Winner[] =>
  winners((cloud.record(T1, 'set', SET)?.payload as { events?: SetEvent[] } | undefined)?.events);

/** Scores one rally in set 1 of the match, as the live screen would. */
const score = (d: TestDevice, winner: Winner) =>
  d.edit((s) => ({
    matches: s.matches.map((m) =>
      m.id === M
        ? {
            ...m,
            sets: m.sets.map((x, i) =>
              i === 0
                ? { ...x, events: [...(x.events ?? []), { type: 'point' as const, winner }] }
                : x,
            ),
          }
        : m,
    ),
  }));

/** Logs what this device pushes (record keys per call). */
function watchPushes(d: TestDevice): string[][] {
  const pushed: string[][] = [];
  const push = d.backend.pushRecords.bind(d.backend);
  d.backend.pushRecords = async (teamId: string, deviceId: string, items: readonly PushItem[]) => {
    pushed.push(items.map((i) => `${i.kind}:${i.id}`));
    return push(teamId, deviceId, items);
  };
  return pushed;
}

/** A scores live; B takes over (and has pulled A's synced rallies). */
async function takenOver(skewMs = 0) {
  const devices = await twoManagers(skewMs);
  const { cloud, a, b } = devices;
  await a.act((e) => holdMatch(e, T1, M));
  cloud.clock.tick(2000);
  await score(a, 'us');
  await a.cycle();
  cloud.clock.tick(2000);
  const taken = await b.act((e) => holdMatch(e, T1, M, true));
  expect(taken).toEqual({ ok: true, value: { granted: true } });
  expect(rallies(b)).toEqual(['us']);
  cloud.clock.tick(2000);
  return devices;
}

const takenOverNotices = (d: TestDevice) => d.runtime.notices.filter((n) => n.kind === 'takenOver');

describe('the previous scorer after a take-over (audit M1)', () => {
  it('can’t overwrite the new scorer’s rallies with a rally scored before it noticed', async () => {
    const { cloud, a, b } = await takenOver();
    await score(b, 'them');
    await score(b, 'them');
    await b.cycle(); // the new scorer's two rallies are on the server
    cloud.clock.tick(2000);
    // A still thinks it is the scorer (its next sync hasn't run) and scores a later rally.
    expect(a.runtime.holds[M]?.deviceId).toBe('dev-a');
    await score(a, 'us');
    await a.cycle();

    expect(cloudRallies(cloud)).toEqual(['us', 'them', 'them']);
    expect(rallies(a)).toEqual(['us', 'them', 'them']);
    expect(a.runtime.status.pending).toBe(0);
    await b.cycle();
    expect(rallies(b)).toEqual(['us', 'them', 'them']);
    // A is told, and the match is read-only there now.
    expect(takenOverNotices(a)).toEqual([
      { kind: 'takenOver', teamId: T1, teamName: TEAM_NAME, holder: 'Ben', undone: 1 },
    ]);
    expect(a.runtime.holds[M]?.deviceId).toBe('dev-b');
  });

  it('reads the holds before anything is pulled or pushed', async () => {
    const { cloud, a } = await takenOver();
    await score(a, 'us');
    cloud.calls.length = 0;
    await a.cycle();
    const holds = cloud.calls.indexOf('listHolds');
    expect(holds).toBeGreaterThan(-1);
    expect(holds).toBeLessThan(cloud.calls.indexOf('pullChanges'));
    expect(cloud.calls.filter((c) => c === 'listHolds')).toHaveLength(1);
  });

  it('holds its unsynced rally back while the other device scores, and loses nothing', async () => {
    const { cloud, a, b } = await takenOver();
    const pushed = watchPushes(a);
    await score(a, 'us'); // scored before A noticed; the new scorer hasn't saved anything
    await a.cycle();
    expect(pushed.flat()).toEqual([]);
    expect(cloudRallies(cloud)).toEqual(['us']);
    expect(rallies(a)).toEqual(['us', 'us']); // still on the device, waiting
    expect(a.runtime.status.pending).toBe(1);
    expect(takenOverNotices(a)).toEqual([]);
    expect(a.engine.yielded.has(M)).toBe(true);

    // Other records of the team still sync meanwhile.
    cloud.clock.tick(2000);
    await a.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Renamed' } : p)),
    }));
    await a.cycle();
    expect(pushed.flat()).toEqual(['player:p1']);
    expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({ firstName: 'Renamed' });

    // The other device stops scoring without having saved the set: A's rally is synced.
    cloud.clock.tick(2000);
    await b.act((e) => releaseMatch(e, T1, M));
    await a.cycle();
    expect(a.engine.yielded.size).toBe(0);
    expect(cloudRallies(cloud)).toEqual(['us', 'us']);
    expect(a.runtime.status.pending).toBe(0);
    await b.cycle();
    expect(rallies(b)).toEqual(['us', 'us']);
    expect(takenOverNotices(a)).toEqual([]);
  });

  it('syncs the held-back rally once the other device’s hold has run out', async () => {
    const { cloud, a } = await takenOver();
    await score(a, 'us');
    await a.cycle();
    expect(cloudRallies(cloud)).toEqual(['us']);
    cloud.clock.tick(16 * 60_000); // the 15-minute hold was never refreshed
    await a.cycle();
    expect(cloudRallies(cloud)).toEqual(['us', 'us']);
  });

  it('gives way to the scorer’s save even when its own clock says it saved later', async () => {
    // A's clock runs 30 s ahead: by "the latest save wins" its rally would beat every save the
    // new scorer makes in the next 30 s.
    const { cloud, a, b } = await takenOver(30_000);
    await score(a, 'us');
    await a.cycle(); // A notices the take-over; its rally waits
    // A leaves the live screen: the match stays yielded while the other hold lasts.
    await a.act((e) => releaseMatch(e, T1, M));
    expect(a.engine.yielded.has(M)).toBe(true);
    expect(cloud.holds.get(`${T1}/${M}`)?.deviceId).toBe('dev-b');
    cloud.clock.tick(2000);
    await score(b, 'them');
    // B's first push is refused (the set's last save carries A's fast clock); re-stamped just
    // after that save, the second one is accepted.
    await b.cycle();
    await b.cycle();
    expect(cloudRallies(cloud)).toEqual(['us', 'them']);
    cloud.clock.tick(2000);
    // A's waiting rally is stamped later than B's save: by the clocks alone it would win.
    const mine = Date.parse(a.data.sync.teams[T1].edits[`set:${SET}`].at);
    expect(mine).toBeGreaterThan(cloud.record(T1, 'set', SET)?.at ?? Infinity);
    await a.cycle();
    expect(rallies(a)).toEqual(['us', 'them']);
    expect(cloudRallies(cloud)).toEqual(['us', 'them']);
    await b.cycle();
    expect(rallies(b)).toEqual(['us', 'them']);
    expect(takenOverNotices(a)).toHaveLength(1);
  });

  it('yields at once when its hold refresh is refused (no sync in between)', async () => {
    const { cloud, a } = await takenOver();
    expect(a.engine.yielded.size).toBe(0);
    const refresh = await a.act((e) => holdMatch(e, T1, M)); // the live screen's 5-minute refresh
    expect(refresh).toEqual({ ok: true, value: { granted: false, holder: 'Ben' } });
    expect(a.engine.yielded.has(M)).toBe(true);
    const pushed = watchPushes(a);
    await score(a, 'us');
    await a.cycle();
    expect(pushed.flat()).toEqual([]);
    expect(cloudRallies(cloud)).toEqual(['us']);
  });

  it('taking the match back starts from what the other scorer saved', async () => {
    const { cloud, a, b } = await takenOver();
    await score(a, 'us');
    await a.cycle(); // A notices; its rally waits
    cloud.clock.tick(2000);
    await score(b, 'them');
    await b.cycle();
    cloud.clock.tick(2000);
    // A takes over again before its next sync: the pull of the take-over applies B's set.
    const back = await a.act((e) => holdMatch(e, T1, M, true));
    expect(back).toEqual({ ok: true, value: { granted: true } });
    expect(rallies(a)).toEqual(['us', 'them']);
    expect(takenOverNotices(a)).toHaveLength(1);
    expect(a.engine.yielded.size).toBe(0);
    expect(a.runtime.holds[M]?.deviceId).toBe('dev-a');
    // A scores again and saves as the scorer.
    cloud.clock.tick(2000);
    await score(a, 'us');
    await a.cycle();
    expect(cloudRallies(cloud)).toEqual(['us', 'them', 'us']);
    await b.cycle();
    expect(rallies(b)).toEqual(['us', 'them', 'us']);
  });

  it('forgets the yielded matches on sign-out', async () => {
    const { a } = await takenOver();
    await a.cycle();
    expect(a.engine.yielded.has(M)).toBe(true);
    await a.act((e) => e.signOut());
    expect(a.engine.yielded.size).toBe(0);
    expect(a.runtime.holds).toEqual({});
  });
});

describe('a scorer whose own hold ran out (no connection in the hall) is not "taken over"', () => {
  /** B, the scorer, loses its connection and keeps scoring until its hold has run out. */
  async function scorerOffline(devices: Awaited<ReturnType<typeof takenOver>>) {
    const { cloud, b } = devices;
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await score(b, 'them');
      cloud.fail = 'offline';
      await b.cycle();
      cloud.fail = null;
    }
    cloud.clock.tick(16 * 60_000);
  }

  it('keeps its rallies when the previous scorer’s open live screen re-claims the match', async () => {
    const devices = await takenOver();
    const { cloud, a, b } = devices;
    await score(a, 'us');
    await a.cycle(); // A yields; its rally waits
    await scorerOffline(devices);
    // A's live screen is still open: its 5-minute refresh gets the free match, and A's
    // waiting rally is synced (the hold it yielded to has run out).
    const refresh = await a.act((e) => holdMatch(e, T1, M));
    expect(refresh).toEqual({ ok: true, value: { granted: true } });
    await a.cycle();
    expect(cloudRallies(cloud)).toEqual(['us', 'us']);
    // B is back: its own hold had run out, so nobody "took over" — its later rallies win.
    await b.cycle();
    expect(b.engine.yielded.size).toBe(0);
    expect(takenOverNotices(b)).toEqual([]);
    expect(rallies(b)).toEqual(['us', 'them', 'them', 'them']);
    expect(cloudRallies(cloud)).toEqual(['us', 'them', 'them', 'them']);
    expect(b.runtime.status.pending).toBe(0);
    await a.cycle();
    expect(rallies(a)).toEqual(['us', 'them', 'them', 'them']);
  });

  it('syncs its rallies at once when another device merely claimed the free match', async () => {
    const devices = await takenOver();
    const { cloud, a, b } = devices;
    await a.cycle(); // A yields (nothing waiting)
    await scorerOffline(devices);
    await a.act((e) => holdMatch(e, T1, M)); // A's open live screen claims the free match
    await b.cycle();
    expect(b.engine.yielded.size).toBe(0);
    expect(cloudRallies(cloud)).toEqual(['us', 'them', 'them', 'them']);
    expect(b.runtime.status.pending).toBe(0);
  });
});

describe('only another device’s save counts as the scorer’s', () => {
  it('this device’s own earlier save coming back (a lost push answer) undoes nothing', async () => {
    const { cloud, a, b } = await twoManagers();
    await a.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    await score(a, 'us');
    // The push reaches the server, but its answer is lost.
    const push = a.backend.pushRecords.bind(a.backend);
    a.backend.pushRecords = async (...args) => {
      await push(...args);
      throw new TypeError('Network request failed');
    };
    await a.cycle();
    a.backend.pushRecords = push;
    expect(cloudRallies(cloud)).toEqual(['us']);
    cloud.clock.tick(2000);
    await score(a, 'them'); // scored on top, not synced yet
    cloud.clock.tick(2000);
    await b.act((e) => holdMatch(e, T1, M, true)); // B takes over and saves nothing
    cloud.clock.tick(2000);
    await a.act((e) => e.syncNow()); // A yields; the pull brings A's own earlier save
    expect(a.engine.yielded.has(M)).toBe(true);
    expect(rallies(a)).toEqual(['us', 'them']);
    expect(takenOverNotices(a)).toEqual([]);
    // Once B is done, A's rally is synced.
    await b.act((e) => releaseMatch(e, T1, M));
    await a.cycle();
    expect(cloudRallies(cloud)).toEqual(['us', 'them']);
  });
});

describe('when the holds can’t be read (a server error, not "no connection")', () => {
  const breakHolds = (d: TestDevice) => {
    d.backend.listHolds = async () => {
      throw new BackendError('unknown', 'holds');
    };
  };
  const rename = (d: TestDevice) =>
    d.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Renamed' } : p)),
    }));

  it('the teams still sync, and the status shows the error', async () => {
    const { cloud, a } = await twoManagers();
    breakHolds(a);
    cloud.clock.tick(2000);
    await rename(a);
    await a.cycle();
    expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({ firstName: 'Renamed' });
    expect(a.runtime.status).toMatchObject({ phase: 'error', error: 'unknown', pending: 0 });
  });

  it('a known hold that has run out no longer holds anything back', async () => {
    const { cloud, a } = await takenOver();
    await score(a, 'us');
    await a.cycle(); // A yields; its rally waits
    breakHolds(a);
    cloud.clock.tick(16 * 60_000); // the other device's hold, as last known, has run out
    await a.cycle();
    expect(cloudRallies(cloud)).toEqual(['us', 'us']);
  });

  it('a yielded match stays yielded (the holds known so far count)', async () => {
    const { cloud, a } = await takenOver();
    await a.cycle();
    expect(a.engine.yielded.has(M)).toBe(true);
    breakHolds(a);
    const pushed = watchPushes(a);
    await score(a, 'us');
    await rename(a);
    await a.cycle();
    expect(pushed.flat()).toEqual(['player:p1']);
    expect(cloudRallies(cloud)).toEqual(['us']);
  });
});

describe('a device that never held the match', () => {
  it('still syncs its later change while another device holds it (the latest save wins)', async () => {
    const { cloud, a, b } = await twoManagers();
    await b.act((e) => holdMatch(e, T1, M)); // B scores; A never opened the live screen
    cloud.clock.tick(2000);
    await score(b, 'them');
    await b.cycle();
    cloud.clock.tick(2000);
    await a.cycle();
    expect(rallies(a)).toEqual(['them']);
    expect(a.runtime.holds[M]?.deviceId).toBe('dev-b');
    // A change made on A afterwards (e.g. offline, on another screen) is pushed as before.
    cloud.clock.tick(2000);
    await score(a, 'us');
    await a.cycle();
    expect(a.engine.yielded.size).toBe(0);
    expect(cloudRallies(cloud)).toEqual(['them', 'us']);
    expect(takenOverNotices(a)).toEqual([]);
  });
});
