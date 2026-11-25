/**
 * v10: what the sync engine needs from a server (docs/V10_SYNC_DESIGN.md §4.2). `SyncBackend` is
 * the whole contract: the engine and its tests only use this interface (the tests use the
 * in-memory `src/test-utils/fakeBackend.ts`), and `supabaseBackend.ts` implements it with
 * supabase-js. A self-hosted or other server only needs another implementation.
 *
 * Every method rejects with a `BackendError` (see `errors.ts`) when the call fails.
 */
import type { PushOutcome } from '@/domain/syncMerge';
import type { RecordKind, RecordPayload } from '@/domain/syncRecords';
import type { MatchHold, TeamRole } from '@/domain/types';

import type { Invite } from './types';

export interface BackendSession {
  userId: string;
  email: string;
}

/** Why the session changed: `signedOut` also when the server ended it (e.g. a revoked token). */
export type SessionEvent = 'signedIn' | 'signedOut' | 'other';

export interface Membership {
  teamId: string;
  role: TeamRole;
}

export interface MemberRow {
  userId: string;
  displayName: string;
  role: TeamRole;
  joinedAt: string;
}

/** One record of a `push_records` batch (`at`: the local save time; no payload = deletion). */
export interface PushItem {
  kind: RecordKind;
  id: string;
  at: string;
  payload?: RecordPayload;
  deleted?: true;
}

/** One page of `pull_changes`: raw rows (validated by the engine) and the server's time. */
export interface PullPage {
  serverNow: string;
  rows: unknown[];
}

export interface HoldResult {
  granted: boolean;
  holderName: string;
  heldUntil: string;
}

export type CreateTeamResult = 'created' | 'member' | 'taken';

export interface SyncBackend {
  /* auth */
  /** Whether a session is stored on the device (read locally, never over the network). */
  hasStoredSession(): Promise<boolean>;
  /** The stored session (refreshed when its token expired). */
  getSession(): Promise<BackendSession | null>;
  /** Calls `listener` whenever the session changes; returns an unsubscribe function. */
  onSessionChange(
    listener: (session: BackendSession | null, event: SessionEvent) => void,
  ): () => void;
  /** Sends a sign-in code by email (creates the account if needed). */
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<BackendSession>;
  /** Signs out on this device only (never other devices). */
  signOut(): Promise<void>;

  /* teams and records */
  memberships(): Promise<Membership[]>;
  /** Team id → name (from the team record), for the teams that have one. */
  teamNames(teamIds: readonly string[]): Promise<Record<string, string>>;
  createTeam(teamId: string, displayName: string): Promise<CreateTeamResult>;
  pushRecords(teamId: string, deviceId: string, items: readonly PushItem[]): Promise<PushOutcome[]>;
  pullChanges(teamId: string, after: number, limit: number): Promise<PullPage>;
  leaveTeam(teamId: string): Promise<void>;
  /** Deletes the team for everyone (`VL008` while its photos remain). */
  deleteTeam(teamId: string): Promise<void>;

  /* members and invites */
  listMembers(teamId: string): Promise<MemberRow[]>;
  setMemberRole(teamId: string, userId: string, role: TeamRole): Promise<void>;
  removeMember(teamId: string, userId: string): Promise<void>;
  listInvites(teamId: string): Promise<Invite[]>;
  createInvite(teamId: string, role: TeamRole, days: number): Promise<Invite>;
  revokeInvite(inviteId: string): Promise<void>;
  joinTeam(code: string, displayName: string): Promise<{ teamId: string; role: TeamRole }>;

  /* live match holds */
  listHolds(teamIds: readonly string[]): Promise<MatchHold[]>;
  holdMatch(
    teamId: string,
    matchId: string,
    deviceId: string,
    holderName: string,
    takeOver: boolean,
  ): Promise<HoldResult>;
  releaseMatch(teamId: string, matchId: string, deviceId: string): Promise<void>;

  /* team and player photos (`<teamId>/<photoId>`) */
  /** Uploads a photo (a data URI); one that already exists counts as uploaded. */
  uploadPhoto(teamId: string, photoId: string, dataUri: string): Promise<void>;
  /** The photo as a data URI. */
  downloadPhoto(teamId: string, photoId: string): Promise<string>;
  listPhotos(teamId: string): Promise<string[]>;
  removePhotos(teamId: string, photoIds: readonly string[]): Promise<void>;

  /* account */
  deletionCheck(): Promise<{ deleteTeams: string[]; blockedTeams: string[] }>;
  /** Deletes the account and its sole-member teams (`VL008` while their photos remain). */
  deleteAccount(): Promise<string[]>;
}
