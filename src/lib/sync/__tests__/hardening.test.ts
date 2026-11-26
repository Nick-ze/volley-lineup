/**
 * v10 audit (medium / low, "hardening"): the cycle survives a throw while it notes changes
 * (L20), and photo ids are checked before they become storage paths (L26).
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import type { SyncedTeam } from '@/domain/types';
import { useAppStore, useSyncRuntime } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { uploadTeams } from '../teamCommands';

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

describe('a cycle that throws while noting changes (audit L20)', () => {
  it('reports the error and the next cycle runs again', async () => {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1());
    await a.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    let good: SyncedTeam | undefined;
    await a.act(async (engine) => {
      good = useAppStore.getState().sync.teams[T1];
      // Bookkeeping that makes change detection throw (no released version writes it).
      useAppStore.setState((s) => ({
        sync: { ...s.sync, teams: { [T1]: { ...s.sync.teams[T1], edits: null } as never } },
      }));
      await expect(engine.runCycle()).resolves.toBeUndefined();
      expect(useSyncRuntime.getState().status).toMatchObject({ phase: 'error', error: 'unknown' });
      // Repaired: the engine isn't stuck on the failed cycle.
      useAppStore.setState((s) => ({ sync: { ...s.sync, teams: { [T1]: good as SyncedTeam } } }));
      const pulls = cloud.calls.filter((c) => c === 'pullChanges').length;
      await engine.runCycle();
      expect(cloud.calls.filter((c) => c === 'pullChanges').length).toBe(pulls + 1);
      expect(useSyncRuntime.getState().status.phase).toBe('synced');
    });
  });
});
