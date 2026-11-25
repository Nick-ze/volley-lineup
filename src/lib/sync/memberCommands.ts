/** v10: members and invite codes of a shared team (managers; members list for everyone). */
import type { TeamRole } from '@/domain/types';

import type { SyncEngine } from './engine';
import { attempt, requireSession } from './result';
import type { Invite, Member, SyncResult } from './types';

export const listMembers = (engine: SyncEngine, teamId: string): Promise<SyncResult<Member[]>> =>
  attempt(async () => {
    const session = requireSession(engine);
    const rows = await engine.backend.listMembers(teamId);
    return rows.map((r) => ({ ...r, isMe: r.userId === session.userId }));
  });

export const setMemberRole = (
  engine: SyncEngine,
  teamId: string,
  userId: string,
  role: TeamRole,
): Promise<SyncResult> =>
  attempt(async () => {
    const session = requireSession(engine);
    await engine.backend.setMemberRole(teamId, userId, role);
    // A manager who made themselves a player can't edit any more: sync the role now.
    if (userId === session.userId) engine.kick();
  });

export const removeMember = (
  engine: SyncEngine,
  teamId: string,
  userId: string,
): Promise<SyncResult> =>
  attempt(async () => {
    requireSession(engine);
    await engine.backend.removeMember(teamId, userId);
  });

export const listInvites = (engine: SyncEngine, teamId: string): Promise<SyncResult<Invite[]>> =>
  attempt(async () => {
    requireSession(engine);
    return engine.backend.listInvites(teamId);
  });

export const createInvite = (
  engine: SyncEngine,
  teamId: string,
  role: TeamRole,
  days: number,
): Promise<SyncResult<Invite>> =>
  attempt(async () => {
    requireSession(engine);
    return engine.backend.createInvite(teamId, role, days);
  });

export const revokeInvite = (engine: SyncEngine, inviteId: string): Promise<SyncResult> =>
  attempt(async () => {
    requireSession(engine);
    await engine.backend.revokeInvite(inviteId);
  });
