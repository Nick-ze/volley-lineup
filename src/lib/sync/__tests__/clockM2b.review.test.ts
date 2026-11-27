/**
 * Review of PR 4 (M2), second file: store writes, two teams, a failing pull, the take-over block.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { teamSlice, type TeamData } from '@/domain/syncRecords';
import type { SetEvent } from '@/domain/types';
import { STORAGE_KEY } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { holdMatch, releaseMatch } from '../holdCommands';
import { createInvite } from '../memberCommands';
import { joinTeam, uploadTeams } from '../teamCommands';
import { noteAll } from '../teamSync';

const T1 = 't1';
const MIN = 60_000;
const M = 'm2';
const SET = `${M}/1`;

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
const cloudName = (cloud: FakeCloud, id: string) =>
  (cloud.record(T1, 'player', id)?.payload as { firstName?: string } | undefined)?.firstName;

const setItem = jest.mocked(AsyncStorage.setItem);
const writes = () => setItem.mock.calls.filter(([key]) => key === STORAGE_KEY).length;

describe('store writes with a clock that is off (M19)', () => {
  it('first cycle of an app run: nothing to do → no write; one change → how many?', async () => {
    const SKEW = 10 * MIN;
    const { cloud, a } = await twoManagers(SKEW);
    cloud.clock.tick(MIN);
    const a2 = await restart(a, 'anna@example.test', SKEW);
    await a2.act(async (engine) => {
      const before = writes();
      await engine.runCycle();

      console.log(`M19 idle first cycle, clock off: ${writes() - before} writes`);
      expect(writes() - before).toBe(0);
    });
    cloud.clock.tick(MIN);
    const a3 = await restart(a2, 'anna@example.test', SKEW);
    await rename(a3, 'p1', 'Mine');
    await a3.act(async (engine) => {
      const before = writes();
      await engine.runCycle();

      console.log(`M19 first cycle with one change, clock off: ${writes() - before} writes`);
      expect(cloudName(cloud, 'p1')).toBe('Mine');
    });
  });
});

type Winner = 'us' | 'them';
const winners = (events: readonly SetEvent[] | undefined): Winner[] =>
  (events ?? []).flatMap((e) => (e.type === 'point' ? [e.winner] : []));
const rallies = (d: TestDevice): Winner[] =>
  winners(d.data.matches.find((m) => m.id === M)?.sets[0]?.events);
const cloudRallies = (cloud: FakeCloud): Winner[] =>
  winners((cloud.record(T1, 'set', SET)?.payload as { events?: SetEvent[] } | undefined)?.events);
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

describe('the take-over block: "this device’s own earlier save coming back undoes nothing"', () => {
  /** takeOverBlock.test.ts, the same test, on a phone whose clock is slow and that sleeps. */
  it('SLOW clock, the phone sleeps between two rallies', async () => {
    const SKEW = -2 * MIN;
    const { cloud, a, b } = await twoManagers(SKEW);
    let slept = 0;
    const sleep = (ms: number) => {
      cloud.clock.tick(ms);
      slept += ms;
    };
    (a.engine as unknown as { clock: unknown }).clock = {
      now: () => cloud.clock.ms + SKEW,
      steady: () => cloud.clock.ms - slept,
    };
    await a.cycle();
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
    // A time-out: the phone sleeps for 30 s, no connection in the hall.
    cloud.fail = 'offline';
    sleep(30_000);
    await score(a, 'them'); // scored on top, not synced yet
    await a.act((e) => noteAll(e));
    sleep(20_000);
    cloud.fail = null;
    await b.act((e) => holdMatch(e, T1, M, true)); // B takes over and saves nothing
    cloud.clock.tick(2000);
    await a.act((e) => e.syncNow()); // A yields; the pull brings A's own earlier save

    console.log(`TAKEOVER/own: A has ${JSON.stringify(rallies(a))}`);
    expect(a.engine.yielded.has(M)).toBe(true);
    expect(rallies(a)).toEqual(['us', 'them']);
    await b.act((e) => releaseMatch(e, T1, M));
    await a.cycle();
    expect(cloudRallies(cloud)).toEqual(['us', 'them']);
  });
});
