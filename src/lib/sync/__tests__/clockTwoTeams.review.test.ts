/** Review of PR 4: two shared teams, one cycle: the first pull's measurement converts both. */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { BackendError } from '../errors';
import { uploadTeams } from '../teamCommands';

const MIN = 60_000;

function both(): TeamData {
  const data = goldenTeamData();
  const ids = ['t1', 't2'].filter((id) => teamSlice(data, id));
  if (ids.length < 2) throw new Error('fixture has no second team');
  return {
    ...data,
    teams: data.teams.map((t) => ({ ...t, profileId: PROFILE.id, photoId: undefined })),
    players: data.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

it('two teams: both teams’ offline changes are converted by the first pull of the cycle', async () => {
  const SKEW = 10 * MIN;
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', both(), { skewMs: SKEW });
  await a.signIn('anna@example.test');
  await a.act((e) => uploadTeams(e, ['t1', 't2']));
  await a.cycle();
  cloud.clock.tick(MIN);
  // A new app run that starts offline.
  const d = new TestDevice(cloud, 'dev-a', {}, { skewMs: SKEW });
  d.data = a.data;
  const session = d.backend.signInAs('anna@example.test');
  await d.act((e) => e.setSession(session));
  cloud.fail = 'offline';
  const byTeam = (teamId: string) => d.data.players.find((p) => p.teamId === teamId)?.id ?? '';
  const p1 = byTeam('t1');
  const p2 = byTeam('t2');
  await d.edit((s) => ({
    players: s.players.map((p) => (p.id === p1 || p.id === p2 ? { ...p, firstName: 'X' } : p)),
  }));
  await d.cycle();
  const noted = cloud.clock.ms;
  expect(Date.parse(d.data.sync.teams.t1.edits[`player:${p1}`].at)).toBe(noted + SKEW);
  expect(Date.parse(d.data.sync.teams.t2.edits[`player:${p2}`].at)).toBe(noted + SKEW);
  cloud.clock.tick(MIN);
  cloud.fail = null;
  d.backend.pushRecords = async () => {
    throw new BackendError('forbidden', '42501');
  };
  await d.act((e) => e.syncNow());
  expect(Date.parse(d.data.sync.teams.t1.edits[`player:${p1}`].at)).toBe(noted);
  expect(Date.parse(d.data.sync.teams.t2.edits[`player:${p2}`].at)).toBe(noted);
});
