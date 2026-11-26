/**
 * v10: who may edit what on this device (docs/V10_SYNC_DESIGN.md §3.8, §7.3). Pure.
 *
 * - A local-only team (not in `sync.teams`) is always editable, exactly as before v10.
 * - A shared team is editable for managers; players only view it (`block: 'viewer'`). The role
 *   is cached in the sync state, so this also works offline and while signed out.
 * - A match that another device is scoring live (an unexpired hold of another device) is
 *   read-only for everyone else (`block: 'held'`), until it expires or a manager takes over.
 * - A shared team that leaves the device is unlinked in the same step (`goneTeamLinks`,
 *   `withoutTeamLinks`): its bookkeeping must never meet other data under the same team id.
 * - A match this device was scoring that another device took over is "yielded" while that
 *   device's hold lasts (`yieldedMatches`): this device stops saving it to the cloud.
 */
import type { MatchHold, SyncData, SyncedTeam, TeamRole } from './types';

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

/**
 * The matches this device has yielded to another scorer (v10 audit M1), after its known holds
 * change from `prev` to `next`: a match another device holds now (unexpired) that this device
 * was the scorer of — its own hold was the last one it knew and **hadn't run out** — or had
 * already yielded. It stays yielded until that other hold ends (released, expired, or taken back
 * here).
 *
 * Only a hold that was still running can have been taken over: the server gives a running hold
 * to another device only on "Take over". A device whose own hold had run out (the scorer in a
 * hall without a connection) may still be the one scoring, while the other device merely
 * claimed the free match — it doesn't yield, and "the latest save wins" as always.
 *
 * While a match is yielded, this device doesn't push the match or its sets, and whatever
 * another device saves for them replaces this device's unsynced changes, whatever the clocks
 * say. A device that never held the match isn't affected either.
 */
export function yieldedMatches(
  yielded: ReadonlySet<string>,
  prev: Readonly<Record<string, MatchHold>>,
  next: Readonly<Record<string, MatchHold>>,
  deviceId: string | null,
  now: number,
): Set<string> {
  const out = new Set<string>();
  if (!deviceId) return out;
  for (const [matchId, hold] of Object.entries(next)) {
    if (holdStatus(hold, deviceId, now) !== 'other') continue;
    const wasScorer = holdStatus(prev[matchId], deviceId, now) === 'mine';
    if (yielded.has(matchId) || wasScorer) out.add(matchId);
  }
  return out;
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

/**
 * True when a linked team that isn't on the device has synced before (something was pulled or
 * pushed): it was deleted here, so it is unlinked — never deleted on the server (DECISIONS
 * #259). A link that hasn't pulled anything yet (a download under way) is not gone.
 */
export function isGoneLink(link: SyncedTeam, onDevice: boolean): boolean {
  return !onDevice && (link.cursor > 0 || Object.keys(link.base).length > 0);
}

/** Ids of the linked teams that are gone from the device (see `isGoneLink`). */
export function goneTeamLinks(
  sync: Pick<SyncData, 'teams'>,
  teamsOnDevice: readonly { id: string }[],
): string[] {
  const here = new Set(teamsOnDevice.map((t) => t.id));
  return Object.keys(sync.teams).filter((id) => isGoneLink(sync.teams[id], here.has(id)));
}

/** `sync` without the links of `teamIds` (the same object when none of them is linked). */
export function withoutTeamLinks(sync: SyncData, teamIds: Iterable<string>): SyncData {
  const teams = { ...sync.teams };
  let changed = false;
  for (const id of teamIds) {
    if (!(id in teams)) continue;
    delete teams[id];
    changed = true;
  }
  return changed ? { ...sync, teams } : sync;
}
