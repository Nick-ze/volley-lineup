/**
 * v10: who may edit what on this device (docs/V10_SYNC_DESIGN.md §3.8, §7.3). Pure.
 *
 * - A local-only team (not in `sync.teams`) is always editable, exactly as before v10.
 * - A shared team is editable for managers; players only view it (`block: 'viewer'`). The role
 *   is cached in the sync state, so this also works offline and while signed out.
 * - A match that another device is scoring live (an unexpired hold of another device) is
 *   read-only for everyone else (`block: 'held'`), until it expires or a manager takes over.
 */
import type { MatchHold, SyncData, TeamRole } from './types';

/** Why editing is blocked: a viewer (player role) or a match held by another device. */
export type EditBlock = 'viewer' | 'held' | null;

export interface TeamAccess {
  shared: boolean;
  role: TeamRole | null;
  canEdit: boolean;
  block: EditBlock;
}

export function teamAccess(sync: SyncData, teamId: string): TeamAccess {
  const linked = sync.teams[teamId];
  if (!linked) return { shared: false, role: null, canEdit: true, block: null };
  const canEdit = linked.role === 'manager';
  return { shared: true, role: linked.role, canEdit, block: canEdit ? null : 'viewer' };
}

export type HoldStatus = 'none' | 'mine' | 'other';

/** Whether a hold is missing / expired, this device's, or another device's (`now` in ms). */
export function holdStatus(
  hold: MatchHold | undefined,
  deviceId: string | null,
  now: number,
): HoldStatus {
  if (!hold || Date.parse(hold.heldUntil) <= now) return 'none';
  return hold.deviceId === deviceId ? 'mine' : 'other';
}

export interface MatchAccess {
  canEdit: boolean;
  block: EditBlock;
  /** The holder's name when `block` is 'held'. */
  holder?: string;
}

export function matchAccess(
  sync: SyncData,
  teamId: string,
  hold: MatchHold | undefined,
  now: number,
): MatchAccess {
  const team = teamAccess(sync, teamId);
  if (!team.canEdit) return { canEdit: false, block: team.block };
  if (team.shared && hold && holdStatus(hold, sync.deviceId, now) === 'other') {
    return { canEdit: false, block: 'held', holder: hold.holderName };
  }
  return { canEdit: true, block: null };
}
