/**
 * v10: shapes returned by the sync module's commands (API results, not persisted data — the
 * persisted sync state is `SyncData` in `src/domain/types.ts`).
 */
import type { SyncErrorCode, TeamRole } from '@/domain/types';

/** Every command resolves (never throws): a value, or an error code for the UI. */
export type SyncResult<T = void> = { ok: true; value: T } | { ok: false; error: SyncErrorCode };

/** A team the signed-in account is a member of in the cloud. */
export interface CloudTeam {
  teamId: string;
  name: string;
  role: TeamRole;
  /** Already shared on this device. */
  onDevice: boolean;
}

export interface Member {
  userId: string;
  displayName: string;
  role: TeamRole;
  joinedAt: string;
  /** The signed-in user. */
  isMe: boolean;
}

export interface Invite {
  id: string;
  /** 10 characters (shown as "ABCDE-FGHJK"). */
  code: string;
  role: TeamRole;
  expiresAt: string;
  revokedAt: string | null;
  uses: number;
  /** How often the code works in all (manager codes: once); null = no limit (player codes). */
  maxUses: number | null;
}

export type UploadResult = 'created' | 'linked' | 'rekeyed' | 'failed';

/** One team of `uploadTeams`. */
export interface UploadItem {
  /** The team's id as given. */
  teamId: string;
  result: UploadResult;
  /** The team's id now, when it got a new one on this device first (`rekeyed`). */
  newTeamId?: string;
  /** Why it failed (`failed`). */
  error?: SyncErrorCode;
}

/** The result of `joinTeam`: the team, the role, and the team's name when the server has it. */
export interface Joined {
  teamId: string;
  role: TeamRole;
  name: string | null;
}
