/**
 * v10 audit (docs/AUDIT_V10.md C1): deleting the linked profile must unlink its shared teams at
 * once. The link used to stay (signed out, no sync cycle drops it); a backup restored afterwards
 * was rebuilt under the stale link and, at the next sign-in, pushed as deletions of everything
 * the backup lacked — for every member.
 */
import { importWithSharedTeams, sharedTeamsOf } from '@/domain/syncImport';
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { transferSnapshot, transferSnapshotNow, useAppStore } from '@/store';
import { FAKE_CODE, FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { linkAccountToProfile, verifyCode } from '../accountCommands';
import { downloadTeams, uploadTeams } from '../teamCommands';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), 't1');
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, profileId: PROFILE.id, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

/** A synced manager device, a backup of it, and two records added (and synced) afterwards. */
async function setup() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  await a.signIn('anna@example.test');
  await a.act((e) => uploadTeams(e, ['t1']));
  await a.cycle();
  const backup = await a.act(() => transferSnapshot());
  cloud.clock.tick(60_000);
  await a.edit((s) => ({
    players: [...s.players, { ...s.players[0], id: 'p-new', number: 98, firstName: 'New' }],
    seasons: [
      ...s.seasons,
      { id: 'se-new', teamId: 't1', name: 'Cup 2027', kind: 'tournament', createdAt: '2026-11-01' },
    ],
  }));
  await a.cycle();
  expect(cloud.record('t1', 'player', 'p-new')?.deleted).toBe(false);
  expect(a.data.sync.teams.t1.edits).toEqual({});
  cloud.clock.tick(60_000);
  return { cloud, a, backup };
}

/** Settings → Import, as `useImport.apply` does it. */
function restore(backup: Awaited<ReturnType<typeof transferSnapshot>>, mode: 'merge' | 'replace') {
  const store = useAppStore.getState();
  const shared = sharedTeamsOf(store.sync.teams, store.teams);
  const result = importWithSharedTeams(transferSnapshotNow(), backup, mode, shared);
  if (!result.ok) throw new Error('import failed');
  store.replaceAll(result.data);
  useAppStore.getState().selectProfile(PROFILE.id);
}

async function signInAgain(a: TestDevice) {
  await a.act(async (e) => {
    expect((await verifyCode(e, 'anna@example.test', FAKE_CODE)).ok).toBe(true);
    linkAccountToProfile(e, PROFILE.id);
    await e.runCycle();
  });
}

describe.each(['replace', 'merge'] as const)(
  'restoring a backup (%s) after the team left the device',
  (mode) => {
    it('delete the linked profile → restore → sign in: nothing is deleted in the cloud', async () => {
      const { cloud, a, backup } = await setup();
      // Profile → delete: signed out, the profile and its teams are gone.
      await a.act(async (e) => {
        await e.signOut();
        useAppStore.getState().deleteProfile(PROFILE.id);
      });
      expect(a.data.teams).toEqual([]);
      expect(a.data.sync).toMatchObject({ account: null, teams: {} });

      cloud.clock.tick(60_000);
      await a.act(() => restore(backup, mode));
      expect(a.data.teams.map((t) => t.id)).toEqual(['t1']);
      expect(a.data.sync.teams).toEqual({}); // a local team now

      cloud.clock.tick(60_000);
      await signInAgain(a);
      expect(cloud.record('t1', 'player', 'p-new')?.deleted).toBe(false);
      expect(cloud.record('t1', 'season', 'se-new')?.deleted).toBe(false);

      // Downloading the cloud team again links the restored copy; the cloud wins.
      await a.act((e) => downloadTeams(e, ['t1']));
      await a.cycle();
      expect(a.data.players.some((p) => p.id === 'p-new')).toBe(true);
      expect(cloud.record('t1', 'player', 'p-new')?.deleted).toBe(false);
      expect(cloud.record('t1', 'season', 'se-new')?.deleted).toBe(false);
    });

    it('a link left behind by 10.0.0 is dropped before it can meet a restored backup', async () => {
      const { cloud, a, backup } = await setup();
      // What 10.0.0 left after deleting the linked profile: no team, no account, the link.
      await a.act(async (e) => {
        await e.signOut();
        const link = useAppStore.getState().sync.teams.t1;
        useAppStore.getState().deleteProfile(PROFILE.id);
        useAppStore.setState((s) => ({ sync: { ...s.sync, teams: { t1: link } } }));
      });
      expect(Object.keys(a.data.sync.teams)).toEqual(['t1']);
      // The engine drops it without a session (app start, any cycle, any change).
      await a.cycle();
      expect(a.data.sync.teams).toEqual({});

      cloud.clock.tick(60_000);
      await a.act(() => restore(backup, mode));
      cloud.clock.tick(60_000);
      await signInAgain(a);
      expect(cloud.record('t1', 'player', 'p-new')?.deleted).toBe(false);
      expect(cloud.record('t1', 'season', 'se-new')?.deleted).toBe(false);
    });

    it('even with the stale link still there, the import does not treat the team as shared', async () => {
      const { cloud, a, backup } = await setup();
      await a.act(async (e) => {
        await e.signOut();
        const link = useAppStore.getState().sync.teams.t1;
        useAppStore.getState().deleteProfile(PROFILE.id);
        useAppStore.setState((s) => ({ sync: { ...s.sync, teams: { t1: link } } }));
        // No cycle in between: restore at once.
        restore(backup, mode);
      });
      // A link whose team wasn't on the device before the import is dropped by `replaceAll`.
      expect(a.data.sync.teams).toEqual({});
      cloud.clock.tick(60_000);
      await signInAgain(a);
      expect(cloud.record('t1', 'player', 'p-new')?.deleted).toBe(false);
      expect(cloud.record('t1', 'season', 'se-new')?.deleted).toBe(false);
    });
  },
);
