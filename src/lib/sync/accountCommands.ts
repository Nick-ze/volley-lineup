/**
 * v10: signing in and out, and deleting the account (docs/V10_SYNC_DESIGN.md §3.9, §3.10 and
 * amendment 1).
 */
import { pendingCount } from '@/domain/syncChanges';

import type { SyncEngine } from './engine';
import { BackendError, isPhotosRemain } from './errors';
import { forgetPhotos, removeAllPhotos } from './photoSync';
import { attempt, requireSession } from './result';
import { appState, emitStatus, linkedTeamIds, teamData, unlinkTeams } from './storeOps';
import type { SyncResult } from './types';

export const requestCode = (engine: SyncEngine, email: string): Promise<SyncResult> =>
  attempt(() => engine.backend.requestCode(email.trim()));

/**
 * Signs in with the emailed code. When the device last synced through another account that
 * still has shared teams here, `switchedFrom` says so (with its unsynced changes) and nothing
 * is linked: the UI asks first, then calls `linkAccountToProfile` (or `signOut`).
 */
export const verifyCode = (
  engine: SyncEngine,
  email: string,
  code: string,
): Promise<
  SyncResult<{ userId: string; switchedFrom: { email: string; pending: number } | null }>
> =>
  attempt(async () => {
    const session = await engine.backend.verifyCode(email.trim(), code.trim());
    engine.setSession(session);
    const s = appState();
    const old = s.sync.account;
    const switched =
      old !== null && old.userId !== session.userId && linkedTeamIds(old.userId).length > 0;
    if (!switched) engine.kick();
    return {
      userId: session.userId,
      switchedFrom: switched
        ? { email: old.email, pending: pendingCount(s.sync, teamData(s), old.userId) }
        : null,
    };
  });

/**
 * Links the signed-in account to a local profile. Teams still linked to another account stop
 * syncing here (their local copies stay); the UI has asked first (`switchedFrom`).
 */
export function linkAccountToProfile(engine: SyncEngine, profileId: string): void {
  const session = engine.session();
  if (!session) return;
  const teams = appState().sync.teams;
  const others = Object.keys(teams).filter((id) => teams[id].userId !== session.userId);
  if (others.length > 0) {
    unlinkTeams(others);
    for (const id of others) forgetPhotos(engine, id);
  }
  appState().setSyncAccount({ userId: session.userId, email: session.email, profileId });
  engine.rewire();
  engine.kick();
}

export const accountDeletionCheck = (
  engine: SyncEngine,
): Promise<SyncResult<{ deleteTeams: string[]; blockedTeams: string[] }>> =>
  attempt(async () => {
    requireSession(engine);
    return engine.backend.deletionCheck();
  });

/**
 * Deletes the account: the photos of the teams that go with it first (the server refuses while
 * they remain), then the account. Afterwards the shared teams stay on the device as local teams,
 * the account link is cleared and the device is signed out. Local data is kept.
 */
export const deleteAccount = (engine: SyncEngine): Promise<SyncResult> =>
  attempt(() =>
    engine.exclusive(async () => {
      requireSession(engine);
      const check = await engine.backend.deletionCheck();
      if (check.blockedTeams.length > 0) throw new BackendError('lastManager');
      const cleanUp = async (teamIds: readonly string[]) => {
        for (const teamId of teamIds) await removeAllPhotos(engine, teamId);
      };
      await cleanUp(check.deleteTeams);
      try {
        await engine.backend.deleteAccount();
      } catch (e) {
        if (!isPhotosRemain(e)) throw e;
        await cleanUp((await engine.backend.deletionCheck()).deleteTeams);
        await engine.backend.deleteAccount();
      }
      const linked = linkedTeamIds();
      unlinkTeams(linked);
      for (const id of linked) forgetPhotos(engine, id);
      await engine.signOut();
      appState().setSyncAccount(null);
      emitStatus({ type: 'disabled' });
    }),
  );
