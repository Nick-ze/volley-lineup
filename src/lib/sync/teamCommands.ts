/**
 * v10: sharing teams — the cloud list, upload, download, join, leave, delete for everyone and
 * unlink (docs/V10_SYNC_DESIGN.md §3.9, §3.11).
 */
import { adoptExisting, EPOCH } from '@/domain/syncMerge';
import { payloadHash, sliceToRecords, type TeamSlice } from '@/domain/syncRecords';
import { isUnlinkedCopy } from '@/domain/syncAccess';
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
import { forgetHeld, needsReset, pullTeam } from './teamSync';
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

/** The team is on this device as a copy that isn't linked (see `isUnlinkedCopy`). */
const isLocalCopy = (teamId: string): boolean =>
  isUnlinkedCopy(appState().sync, appState().teams, teamId);

/**
 * Links a cloud team on this device. A team already here (an old local copy with the same id)
 * gives way to the cloud: managers adopt it with "saved at the epoch" edits (the cloud wins
 * where both have a record; local-only records are pushed), viewers get the cloud's copy.
 * Since the v10 audit's M7 no command does that to a copy unasked: `downloadTeams` only for the
 * teams in `replaceCopies`, `joinTeam` and `uploadTeams` not at all (they say so in their
 * results).
 */
function linkCloudTeam(engine: SyncEngine, userId: string, teamId: string, role: TeamRole): void {
  const meta = appState().sync.teams[teamId];
  if (meta) {
    // The role of a team that is already linked changes only in the cycle's membership check,
    // which replaces the local copy with the cloud's first — after a demotion and, since the
    // v10 audit (H8), after a promotion too (e.g. a manager code used by a player).
    if (meta.userId !== userId) setTeamMeta(teamId, { ...meta, userId });
    return;
  }
  const slice = sliceOf(appState(), teamId);
  if (!slice) setTeamMeta(teamId, newMeta(userId, role));
  else if (role === 'manager') setTeamMeta(teamId, newMeta(userId, role, adoptExisting(slice)));
  else {
    // A viewer gets the cloud's copy: a `base` of the local records (cursor 0) marks the reset
    // in the persisted state (`needsReset`), so it also happens after a restart.
    engine.resetPending.add(teamId);
    setTeamMeta(teamId, { ...newMeta(userId, role), base: localBase(slice) });
  }
}

/** A `base` of the local copy's records at version 0 (nothing pulled yet). */
function localBase(slice: TeamSlice): SyncedTeam['base'] {
  const base: SyncedTeam['base'] = {};
  for (const [key, payload] of sliceToRecords(slice)) {
    base[key] = { v: 0, h: payloadHash(payload), at: EPOCH };
  }
  return base;
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
  try {
    let outcome = await engine.backend.createTeam(id, name);
    if (outcome === 'taken') {
      id = rekey(id);
      outcome = await engine.backend.createTeam(id, name);
    }
    const moved = id === teamId ? {} : { newTeamId: id };
    if (outcome === 'taken') return { teamId, result: 'failed', error: 'unknown', ...moved };
    // The account already belongs to a cloud team with this id: this team is an older copy of
    // it. Linking would replace it with the cloud's version — only after a question (M7), and
    // that is asked where the team is downloaded.
    if (outcome === 'member') return { teamId, result: 'inCloud', ...moved };
    setTeamMeta(id, newMeta(session.userId, 'manager'));
    return { teamId, result: id !== teamId ? 'rekeyed' : 'created', ...moved };
  } catch (e) {
    // The team already has its new id on this device: the caller must learn it, whatever failed.
    if (id === teamId) throw e;
    return { teamId, result: 'failed', error: toSyncError(e), newTeamId: id };
  }
}

/**
 * Shares local teams: each is created in the cloud (`created`), moved to a new id first because
 * its id was taken or isn't allowed on the server (`rekeyed`, with `newTeamId`), or left as it
 * is because the account already belongs to a cloud team with its id (`inCloud`: an older copy).
 * A team that is already shared on this device answers `linked`.
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

/**
 * Downloads cloud teams of the account to this device (under the linked profile). A team this
 * device has an older, unlinked copy of is only downloaded when it is in `replaceCopies` — the
 * user was asked and agreed (v10 audit M7); the others are left as they are and returned.
 */
export const downloadTeams = (
  engine: SyncEngine,
  teamIds: string[],
  replaceCopies: readonly string[] = [],
): Promise<SyncResult<string[]>> =>
  attempt(() =>
    engine.exclusive(async () => {
      const session = requireSession(engine);
      const roles = new Map((await engine.backend.memberships()).map((m) => [m.teamId, m.role]));
      const members = teamIds.filter((id) => roles.has(id));
      const kept = members.filter((id) => isLocalCopy(id) && !replaceCopies.includes(id));
      const wanted = members.filter((id) => !kept.includes(id));
      for (const teamId of wanted) {
        linkCloudTeam(engine, session.userId, teamId, roles.get(teamId) as TeamRole);
      }
      engine.rewire();
      try {
        for (const teamId of wanted) {
          const reset = needsReset(engine, teamId);
          const report = await pullTeam(engine, teamId, reset);
          if (reset && report.present) engine.resetPending.delete(teamId);
        }
      } finally {
        engine.kick();
      }
      return kept;
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
  engine.forgetAwaited(teamId);
  forgetHeld(engine, teamId);
  engine.rewire();
}

/**
 * Codes this app run joined with, per engine and account (v10 audit L11): a double submit of a
 * single-use manager code would otherwise read "invalid code" although the first join worked.
 */
const joinedCodes = new WeakMap<SyncEngine, Map<string, Joined & { userId: string }>>();

/** Joins a team with an invite code; the team downloads in the background. */
export const joinTeam = (engine: SyncEngine, code: string): Promise<SyncResult<Joined>> =>
  attempt(() =>
    engine.exclusive(async () => {
      const session = requireSession(engine);
      const known = joinedCodes.get(engine)?.get(code);
      if (known && known.userId === session.userId) {
        const meta = appState().sync.teams[known.teamId];
        const { userId: _user, ...again } = known;
        if (meta?.userId === session.userId) return { ...again, role: meta.role, localCopy: false };
        // Still waiting for the user's answer about the older copy: the join itself is done.
        if (!meta && isLocalCopy(known.teamId)) return { ...again, localCopy: true };
      }
      const joined = await engine.backend.joinTeam(code, displayName());
      // The name is a nicety: a failure here doesn't undo the join.
      const names = await engine.backend
        .teamNames([joined.teamId])
        .catch((): Record<string, string> => ({}));
      // An older copy of the team on this device isn't replaced unasked (M7): the account is a
      // member now, and the team is downloaded once the user has agreed (`downloadTeams`).
      const localCopy = isLocalCopy(joined.teamId);
      if (!localCopy) {
        linkCloudTeam(engine, session.userId, joined.teamId, joined.role);
        engine.rewire();
        engine.kick();
      }
      const result = { ...joined, name: names[joined.teamId] ?? null, localCopy };
      const codes = joinedCodes.get(engine) ?? new Map<string, Joined & { userId: string }>();
      codes.set(code, { ...result, userId: session.userId });
      joinedCodes.set(engine, codes);
      return result;
    }),
  );
