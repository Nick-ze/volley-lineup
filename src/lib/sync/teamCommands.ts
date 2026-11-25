/**
 * v10: sharing teams — the cloud list, upload, download, join, leave, delete for everyone and
 * unlink (docs/V10_SYNC_DESIGN.md §3.9, §3.11).
 */
import { adoptExisting } from '@/domain/syncMerge';
import { isServerSafeTeamId, rekeyTeam } from '@/domain/syncUpload';
import type { SyncedTeam, TeamRole } from '@/domain/types';
import { createId } from '@/lib/id';

import type { BackendSession } from './backend';
import type { SyncEngine } from './engine';
import { isPhotosRemain, toSyncError } from './errors';
import { forgetPhotos, removeAllPhotos } from './photoSync';
import { attempt, requireSession } from './result';
import {
  appState,
  displayName,
  setTeamMeta,
  sliceOf,
  teamData,
  teamName,
  transaction,
  unlinkTeams,
} from './storeOps';
import { pullTeam } from './teamSync';
import type { CloudTeam, Joined, SyncResult, UploadItem } from './types';

/** Errors that end a whole command (the others only fail one team). */
const FATAL = new Set(['offline', 'signedOut', 'notSignedIn']);

const newMeta = (userId: string, role: TeamRole, edits: SyncedTeam['edits'] = {}): SyncedTeam => ({
  userId,
  role,
  cursor: 0,
  base: {},
  edits,
  photos: [],
});

/**
 * Links a cloud team on this device. A team already here (an old local copy with the same id)
 * gives way to the cloud: managers adopt it with "saved at the epoch" edits (the cloud wins
 * where both have a record; local-only records are pushed), viewers get the cloud's copy.
 */
function linkCloudTeam(engine: SyncEngine, userId: string, teamId: string, role: TeamRole): void {
  const meta = appState().sync.teams[teamId];
  if (meta) {
    if (meta.role !== role || meta.userId !== userId)
      setTeamMeta(teamId, { ...meta, role, userId });
    return;
  }
  const slice = sliceOf(appState(), teamId);
  if (slice && role === 'player') engine.resetPending.add(teamId);
  setTeamMeta(
    teamId,
    newMeta(userId, role, slice && role === 'manager' ? adoptExisting(slice) : {}),
  );
}

export const listCloudTeams = (engine: SyncEngine): Promise<SyncResult<CloudTeam[]>> =>
  attempt(async () => {
    requireSession(engine);
    const memberships = await engine.backend.memberships();
    const names = await engine.backend.teamNames(memberships.map((m) => m.teamId));
    const linked = appState().sync.teams;
    return memberships.map((m) => ({
      teamId: m.teamId,
      name: names[m.teamId] ?? teamName(m.teamId),
      role: m.role,
      onDevice: m.teamId in linked,
    }));
  });

/** The local team gets a new id (copy-on-write, the whole team moves); returns the new id. */
function rekey(teamId: string): string {
  const newId = createId();
  transaction((s) => rekeyTeam(teamData(s), teamId, newId));
  return newId;
}

async function uploadOne(
  engine: SyncEngine,
  session: BackendSession,
  teamId: string,
  name: string,
): Promise<UploadItem> {
  if (appState().sync.teams[teamId]) return { teamId, result: 'linked' };
  if (!appState().teams.some((t) => t.id === teamId)) {
    return { teamId, result: 'failed', error: 'unknown' };
  }
  let id = isServerSafeTeamId(teamId) ? teamId : rekey(teamId);
  let outcome = await engine.backend.createTeam(id, name);
  if (outcome === 'taken') {
    id = rekey(id);
    outcome = await engine.backend.createTeam(id, name);
  }
  const moved = id === teamId ? {} : { newTeamId: id };
  if (outcome === 'taken') return { teamId, result: 'failed', error: 'unknown', ...moved };
  if (outcome === 'created') {
    setTeamMeta(id, newMeta(session.userId, 'manager'));
  } else {
    const roles = await engine.backend.memberships();
    linkCloudTeam(engine, session.userId, id, roles.find((m) => m.teamId === id)?.role ?? 'player');
  }
  const result = id !== teamId ? 'rekeyed' : outcome === 'created' ? 'created' : 'linked';
  return { teamId, result, ...moved };
}

/**
 * Shares local teams: each is created in the cloud (`created`), linked to the cloud team with
 * its id that the account already belongs to (`linked`), or moved to a new id first because
 * its id was taken or isn't allowed on the server (`rekeyed`, with `newTeamId`).
 */
export const uploadTeams = (
  engine: SyncEngine,
  teamIds: string[],
): Promise<SyncResult<UploadItem[]>> =>
  attempt(() =>
    engine.exclusive(async () => {
      const session = requireSession(engine);
      const name = displayName();
      const items: UploadItem[] = [];
      try {
        for (const teamId of teamIds) {
          try {
            items.push(await uploadOne(engine, session, teamId, name));
          } catch (e) {
            const error = toSyncError(e);
            if (FATAL.has(error)) throw e;
            items.push({ teamId, result: 'failed', error });
          }
        }
      } finally {
        engine.rewire();
        engine.kick();
      }
      return items;
    }),
  );

/** Downloads cloud teams of the account to this device (under the linked profile). */
export const downloadTeams = (engine: SyncEngine, teamIds: string[]): Promise<SyncResult> =>
  attempt(() =>
    engine.exclusive(async () => {
      const session = requireSession(engine);
      const roles = new Map((await engine.backend.memberships()).map((m) => [m.teamId, m.role]));
      const wanted = teamIds.filter((id) => roles.has(id));
      for (const teamId of wanted) {
        linkCloudTeam(engine, session.userId, teamId, roles.get(teamId) as TeamRole);
      }
      engine.rewire();
      try {
        for (const teamId of wanted) {
          const reset = engine.resetPending.has(teamId);
          const report = await pullTeam(engine, teamId, reset);
          if (reset && report.present) engine.resetPending.delete(teamId);
        }
      } finally {
        engine.kick();
      }
    }),
  );

/** Unlinks the team and removes it from the device. */
function removeHere(engine: SyncEngine, teamId: string): void {
  unlinkTeam(engine, teamId);
  appState().deleteTeam(teamId);
}

/** "Delete for everyone" (managers): photos first, then the team; then it goes from here too. */
export const deleteTeamEverywhere = (engine: SyncEngine, teamId: string): Promise<SyncResult> =>
  attempt(() =>
    engine.exclusive(async () => {
      requireSession(engine);
      await removeAllPhotos(engine, teamId);
      try {
        await engine.backend.deleteTeam(teamId);
      } catch (e) {
        if (!isPhotosRemain(e)) throw e;
        await removeAllPhotos(engine, teamId);
        await engine.backend.deleteTeam(teamId);
      }
      removeHere(engine, teamId);
    }),
  );

/** Leaves a shared team; it goes from this device too. */
export const leaveTeam = (engine: SyncEngine, teamId: string): Promise<SyncResult> =>
  attempt(() =>
    engine.exclusive(async () => {
      requireSession(engine);
      await engine.backend.leaveTeam(teamId);
      removeHere(engine, teamId);
    }),
  );

/** Stops syncing the team on this device (the local copy and the cloud team stay). */
export function unlinkTeam(engine: SyncEngine, teamId: string): void {
  unlinkTeams([teamId]);
  forgetPhotos(engine, teamId);
  engine.resetPending.delete(teamId);
  engine.rewire();
}

/** Joins a team with an invite code; the team downloads in the background. */
export const joinTeam = (engine: SyncEngine, code: string): Promise<SyncResult<Joined>> =>
  attempt(() =>
    engine.exclusive(async () => {
      const session = requireSession(engine);
      const joined = await engine.backend.joinTeam(code, displayName());
      // The name is a nicety: a failure here doesn't undo the join.
      const names = await engine.backend
        .teamNames([joined.teamId])
        .catch((): Record<string, string> => ({}));
      linkCloudTeam(engine, session.userId, joined.teamId, joined.role);
      engine.rewire();
      engine.kick();
      return { ...joined, name: names[joined.teamId] ?? null };
    }),
  );
