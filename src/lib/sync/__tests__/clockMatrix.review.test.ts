/**
 * Review of PR 4 (M2): who wins, for the owner's three cases × A's clock (fast, slow, right)
 * × which save really was later. B's clock is right. Prints one line per case; runs on the base
 * and on the reviewed code.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { createInvite } from '../memberCommands';
import { joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const MIN = 60_000;

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

const rename = (d: TestDevice, firstName: string) =>
  d.edit((s) => ({ players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName } : p)) }));
const cloudName = (cloud: FakeCloud) =>
  (cloud.record(T1, 'player', 'p1')?.payload as { firstName?: string } | undefined)?.firstName;

type Case = 'offline' | 'neverPulled' | 'restart';
const lines: string[] = [];

async function run(kind: Case, skew: number, later: 'A' | 'B'): Promise<void> {
  const { cloud, a, b } = await twoManagers(skew);
  let dev = a;
  cloud.clock.tick(MIN);
  // "neverPulled" / "restart": a new app run that starts without a connection.
  cloud.fail = 'offline';
  if (kind !== 'offline') dev = await restart(dev, 'anna@example.test', skew);
  const editA = async () => {
    cloud.fail = 'offline';
    await rename(dev, 'A');
    await dev.cycle(); // offline: the change is noted
    cloud.fail = null;
  };
  const editB = async () => {
    cloud.fail = null;
    await rename(b, 'B');
    await b.cycle();
  };
  if (later === 'B') {
    await editA();
    cloud.clock.tick(MIN);
    await editB();
  } else {
    await editB();
    cloud.clock.tick(MIN);
    await editA();
  }
  cloud.clock.tick(MIN);
  cloud.fail = null;
  // "restart": the app is closed and opened again before the connection is back.
  if (kind === 'restart') dev = await restart(dev, 'anna@example.test', skew);
  await dev.act((e) => e.syncNow());
  await dev.cycle();
  await b.cycle();
  await dev.cycle();
  const won = cloudName(cloud);
  const clock = skew > 0 ? 'fast' : skew < 0 ? 'slow' : 'right';
  lines.push(
    `${kind.padEnd(11)} A ${clock.padEnd(5)} later=${later} → ${won}${won === later ? '' : '  (the earlier save won)'}`,
  );
  expect(dev.data.players.find((p) => p.id === 'p1')?.firstName).toBe(won);
  expect(b.data.players.find((p) => p.id === 'p1')?.firstName).toBe(won);
}

it('matrix', async () => {
  for (const kind of ['offline', 'neverPulled', 'restart'] as const)
    for (const skew of [10 * MIN, -10 * MIN, 0])
      for (const later of ['A', 'B'] as const) await run(kind, skew, later);

  console.log(lines.join('\n'));
});
