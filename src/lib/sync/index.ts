/**
 * v10: the ONLY way the app talks to the backend (docs/V10_SYNC_DESIGN.md §4.2). Screens and
 * features import this barrel only; `@supabase/*` may be imported inside `src/lib/sync/` and
 * nowhere else (ESLint). Swapping to another server means changing this folder only.
 *
 * Every command resolves (never throws) with `{ ok, value | error }`; nothing here may block a
 * screen — the local store stays the source the UI reads.
 *
 * FOUNDATION STUBS: the engine (worker B, PR 2) replaces the bodies; the signatures are fixed.
 * Jest uses `__mocks__/index.ts` (see jest.setup.ts).
 */
import type { TeamRole } from '@/domain/types';

import type { CloudTeam, Invite, Member, SyncResult, UploadResult } from './types';

export { isSyncConfigured } from './config';
export type { CloudTeam, Invite, Member, SyncResult, UploadResult } from './types';

const notYet = async <T>(): Promise<SyncResult<T>> => ({ ok: false, error: 'offline' });

/** Starts background sync (on app open); returns a stop function. Called by `SyncHost`. */
export function startSync(): () => void {
  return () => undefined;
}
/** Sync every shared team now (resets the offline back-off). */
export async function syncNow(): Promise<void> {}
/** Poll faster while a live screen of a shared match is open (null = stop). */
export function followMatch(_matchId: string | null): void {}

// Account (worker C)
export const requestCode = (_email: string): Promise<SyncResult> => notYet();
export const verifyCode = (
  _email: string,
  _code: string,
): Promise<
  SyncResult<{ userId: string; switchedFrom: { email: string; pending: number } | null }>
> => notYet();
/** Links the signed-in account to a local profile (shared teams live under it). */
export function linkAccountToProfile(_profileId: string): void {}
/** Signs out on this device only (never other devices). Local data stays. */
export async function signOut(): Promise<void> {}
export const accountDeletionCheck = (): Promise<
  SyncResult<{ deleteTeams: string[]; blockedTeams: string[] }>
> => notYet();
export const deleteAccount = (): Promise<SyncResult> => notYet();
export const listCloudTeams = (): Promise<SyncResult<CloudTeam[]>> => notYet();
export const uploadTeams = (
  _teamIds: string[],
): Promise<SyncResult<{ teamId: string; result: UploadResult }[]>> => notYet();
export const downloadTeams = (_teamIds: string[]): Promise<SyncResult> => notYet();

// Teams and members (worker D, E2)
export const deleteTeamEverywhere = (_teamId: string): Promise<SyncResult> => notYet();
export const leaveTeam = (_teamId: string): Promise<SyncResult> => notYet();
/** Removes a shared team from this device only (it stays in the cloud). */
export function unlinkTeam(_teamId: string): void {}
export const listMembers = (_teamId: string): Promise<SyncResult<Member[]>> => notYet();
export const setMemberRole = (
  _teamId: string,
  _userId: string,
  _role: TeamRole,
): Promise<SyncResult> => notYet();
export const removeMember = (_teamId: string, _userId: string): Promise<SyncResult> => notYet();
export const listInvites = (_teamId: string): Promise<SyncResult<Invite[]>> => notYet();
export const createInvite = (
  _teamId: string,
  _role: TeamRole,
  _days: number,
): Promise<SyncResult<Invite>> => notYet();
export const revokeInvite = (_inviteId: string): Promise<SyncResult> => notYet();
export const joinTeam = (_code: string): Promise<SyncResult<{ teamId: string; role: TeamRole }>> =>
  notYet();

// Live match holds (worker E1)
export const holdMatch = (
  _teamId: string,
  _matchId: string,
  _takeOver?: boolean,
): Promise<SyncResult<{ granted: boolean; holder?: string }>> => notYet();
export async function releaseMatch(_teamId: string, _matchId: string): Promise<void> {}
