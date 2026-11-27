/** Review of PR 4: a check of the proposed fix A against "the cloud wins" when a team is linked again. */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { downloadTeams, unlinkTeam, uploadTeams } from '../teamCommands';

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

it('linking an old local copy again: the cloud wins, also for rows this device saved itself', async () => {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  await a.signIn('anna@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  cloud.clock.tick(60_000);
  await a.act((e) => unlinkTeam(e, T1));
  await a.edit((s) => ({
    players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'While unlinked' } : p)),
  }));
  cloud.clock.tick(60_000);
  await a.act((e) => downloadTeams(e, [T1]));
  await a.cycle();
  const cloudName = (cloud.record(T1, 'player', 'p1')?.payload as { firstName?: string }).firstName;

  console.log(
    `RELINK: device "${a.data.players.find((p) => p.id === 'p1')?.firstName}", cloud "${cloudName}"`,
  );
  expect(cloudName).not.toBe('While unlinked');
});
