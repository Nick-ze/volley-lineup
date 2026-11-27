/**
 * v10: the ONLY way the app talks to the backend (docs/V10_SYNC_DESIGN.md §4.2). Screens and
 * features import this barrel only; `@supabase/*` may be imported inside `src/lib/sync/` and
 * nowhere else (ESLint). Swapping to another server means changing this folder only
 * (`SyncBackend` in `backend.ts`).
 *
 * Every command resolves (never throws) with `{ ok, value | error }`; nothing here may block a
 * screen — the local store stays the source the UI reads. Without a session no command makes a
 * network call (`notSignedIn`).
 *
 * Jest uses `__mocks__/index.ts` (see jest.setup.ts); the engine's own tests build an engine
 * with the in-memory `src/test-utils/fakeBackend.ts`.
 */
import type { TeamRole } from '@/domain/types';

import * as account from './accountCommands';
import { getClient } from './client';
import { isSyncConfigured } from './config';
import { createEngine, type SyncEngine } from './engine';
import * as holds from './holdCommands';
import * as members from './memberCommands';
import { createSupabaseBackend } from './supabaseBackend';
import * as teams from './teamCommands';
import type { CloudTeam, Invite, Joined, Member, SyncResult, UploadItem } from './types';

export { isSyncConfigured } from './config';
export type {
  CloudTeam,
  Invite,
  Joined,
  Member,
  SyncResult,
  UploadItem,
  UploadResult,
} from './types';

let instance: SyncEngine | null = null;

/** The app's engine, created on first use (the supabase-js client only when a call needs it). */
function engine(): SyncEngine {
  instance ??= createEngine(createSupabaseBackend(getClient));
  return instance;
}

/** Starts background sync (on app open); returns a stop function. Called by `SyncHost`. */
export function startSync(): () => void {
  if (!isSyncConfigured()) return () => undefined;
  return engine().start();
}
/** Sync every shared team now (resets the offline back-off). */
export const syncNow = (): Promise<void> => engine().syncNow();
/** Poll faster while a live screen of a shared match is open (null = stop). */
export const followMatch = (matchId: string | null): void => engine().followMatch(matchId);

// Account
export const requestCode = (email: string): Promise<SyncResult> =>
  account.requestCode(engine(), email);
export const verifyCode = (
  email: string,
  code: string,
): Promise<
  SyncResult<{ userId: string; switchedFrom: { email: string; pending: number } | null }>
> => account.verifyCode(engine(), email, code);
/** Links the signed-in account to a local profile (shared teams live under it). */
export const linkAccountToProfile = (profileId: string): void =>
  account.linkAccountToProfile(engine(), profileId);
/** Signs out on this device only (never other devices). Local data stays. */
export const signOut = (): Promise<void> => engine().signOut();
export const accountDeletionCheck = (): Promise<
  SyncResult<{ deleteTeams: string[]; blockedTeams: string[] }>
> => account.accountDeletionCheck(engine());
export const deleteAccount = (): Promise<SyncResult> => account.deleteAccount(engine());
export const listCloudTeams = (): Promise<SyncResult<CloudTeam[]>> =>
  teams.listCloudTeams(engine());
export const uploadTeams = (teamIds: string[]): Promise<SyncResult<UploadItem[]>> =>
  teams.uploadTeams(engine(), teamIds);
export const downloadTeams = (
  teamIds: string[],
  replaceCopies: readonly string[] = [],
): Promise<SyncResult<string[]>> => teams.downloadTeams(engine(), teamIds, replaceCopies);

// Teams and members
export const deleteTeamEverywhere = (teamId: string): Promise<SyncResult> =>
  teams.deleteTeamEverywhere(engine(), teamId);
export const leaveTeam = (teamId: string): Promise<SyncResult> => teams.leaveTeam(engine(), teamId);
/** Removes a shared team from this device only (it stays in the cloud). */
export const unlinkTeam = (teamId: string): void => teams.unlinkTeam(engine(), teamId);
export const listMembers = (teamId: string): Promise<SyncResult<Member[]>> =>
  members.listMembers(engine(), teamId);
export const setMemberRole = (
  teamId: string,
  userId: string,
  role: TeamRole,
): Promise<SyncResult> => members.setMemberRole(engine(), teamId, userId, role);
export const removeMember = (teamId: string, userId: string): Promise<SyncResult> =>
  members.removeMember(engine(), teamId, userId);
export const listInvites = (teamId: string): Promise<SyncResult<Invite[]>> =>
  members.listInvites(engine(), teamId);
export const createInvite = (
  teamId: string,
  role: TeamRole,
  days: number,
): Promise<SyncResult<Invite>> => members.createInvite(engine(), teamId, role, days);
export const revokeInvite = (inviteId: string): Promise<SyncResult> =>
  members.revokeInvite(engine(), inviteId);
export const joinTeam = (code: string): Promise<SyncResult<Joined>> =>
  teams.joinTeam(engine(), code);

// Live match holds
export const holdMatch = (
  teamId: string,
  matchId: string,
  takeOver?: boolean,
): Promise<SyncResult<{ granted: boolean; holder?: string }>> =>
  holds.holdMatch(engine(), teamId, matchId, takeOver);
export const releaseMatch = (teamId: string, matchId: string): Promise<void> =>
  holds.releaseMatch(engine(), teamId, matchId);
