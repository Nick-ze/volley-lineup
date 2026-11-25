/**
 * v10 sync engine tests: an in-memory `SyncBackend` with the server's rules (docs/SUPABASE.md):
 * - sign-in with the code `123456` (any email; the user is created on first use);
 * - teams with members and roles; only managers write (`42501` else), the last manager can't
 *   leave (`VL001`), the only member can't leave (`VL004`), a removed member can't come back with
 *   an older code (`VL002`), at most 10 created teams (`VL006`);
 * - records with last write wins by `(clamped at, device id)` and a global version sequence;
 *   `pull_changes` pages with `server_now`;
 * - invites, live holds (15 min, take over) and photos (`<teamId>/<photoId>`; `VL008` while a
 *   deleted team's photos remain).
 *
 * `FakeCloud` is the server shared by all devices; `cloud.device()` gives one device's backend
 * (its own session). `cloud.calls` logs every network call; `cloud.fail` simulates no connection
 * (`'offline'`, a fetch `TypeError`) or a paused project (`'paused'`, HTTP 540).
 */
import type {
  BackendSession,
  HoldResult,
  MemberRow,
  PushItem,
  SessionEvent,
  SyncBackend,
} from '@/lib/sync/backend';
import { BackendError } from '@/lib/sync/errors';
import type { Invite } from '@/lib/sync/types';
import type { PushOutcome } from '@/domain/syncMerge';
import type { RecordKind } from '@/domain/syncRecords';
import type { MatchHold, TeamRole } from '@/domain/types';

import { Clock } from './syncFixtures';

export const FAKE_CODE = '123456';

interface Row {
  kind: RecordKind;
  id: string;
  payload: unknown;
  deleted: boolean;
  at: number;
  updatedAt: number;
  version: number;
  deviceId: string;
}

interface FakeTeam {
  createdBy: string;
  members: Map<string, { role: TeamRole; displayName: string; joinedAt: number }>;
  records: Map<string, Row>;
  removals: Map<string, number>;
}

interface FakeInvite {
  id: string;
  teamId: string;
  code: string;
  role: TeamRole;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  uses: number;
  maxUses: number | null;
}

interface FakeHold extends MatchHold {
  until: number;
}

const iso = (ms: number) => new Date(ms).toISOString();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** The n-th invite code (10 letters of the server's alphabet). */
function inviteCode(n: number): string {
  let code = '';
  for (let i = 0, rest = n * 7919; i < 10; i += 1, rest = Math.floor(rest / 32)) {
    code += CODE_ALPHABET[(rest + i) % 32];
  }
  return code;
}
const sqlError = (code: string, app: ConstructorParameters<typeof BackendError>[0]) =>
  new BackendError(app, code);

export class FakeCloud {
  users = new Map<string, string>(); // email → user id
  deletedUsers = new Set<string>();
  teams = new Map<string, FakeTeam>();
  invites: FakeInvite[] = [];
  holds = new Map<string, FakeHold>(); // `${teamId}/${matchId}`
  photos = new Map<string, string>(); // `${teamId}/${photoId}` → data URI
  version = 0;
  calls: string[] = [];
  fail: null | 'offline' | 'paused' = null;
  /** Photo downloads that fail (`${teamId}/${photoId}`). */
  brokenPhotos = new Set<string>();
  private nextId = 0;

  constructor(readonly clock: Clock = new Clock()) {}

  /** Logs a network call and simulates the connection. */
  call(name: string): void {
    this.calls.push(name);
    if (this.fail === 'offline') throw new TypeError('Network request failed');
    if (this.fail === 'paused') throw { status: 540, message: 'Project paused', code: '' };
  }

  id(prefix: string): string {
    this.nextId += 1;
    return `${prefix}-${this.nextId}`;
  }

  userId(email: string): string {
    const known = this.users.get(email);
    if (known) return known;
    const id = this.id('user');
    this.users.set(email, id);
    return id;
  }

  team(teamId: string): FakeTeam {
    const team = this.teams.get(teamId);
    if (!team) throw sqlError('42501', 'forbidden');
    return team;
  }

  role(teamId: string, userId: string): TeamRole | null {
    return this.teams.get(teamId)?.members.get(userId)?.role ?? null;
  }

  photoCount(teamId: string): number {
    return [...this.photos.keys()].filter((k) => k.startsWith(`${teamId}/`)).length;
  }

  /** A record's server row (tests). */
  record(teamId: string, kind: RecordKind, id: string): Row | undefined {
    return this.teams.get(teamId)?.records.get(`${kind}:${id}`);
  }

  device(): FakeBackend {
    return new FakeBackend(this);
  }
}

export class FakeBackend implements SyncBackend {
  session: BackendSession | null = null;
  private listeners = new Set<(s: BackendSession | null, e: SessionEvent) => void>();

  constructor(readonly cloud: FakeCloud) {}

  private get now(): number {
    return this.cloud.clock.ms;
  }

  private me(name: string): string {
    this.cloud.call(name);
    const userId = this.session?.userId;
    if (!userId || this.cloud.deletedUsers.has(userId)) throw sqlError('42501', 'forbidden');
    return userId;
  }

  private member(name: string, teamId: string): string {
    const userId = this.me(name);
    if (!this.cloud.role(teamId, userId)) throw sqlError('42501', 'forbidden');
    return userId;
  }

  private manager(name: string, teamId: string): string {
    const userId = this.me(name);
    if (this.cloud.role(teamId, userId) !== 'manager') throw sqlError('42501', 'forbidden');
    return userId;
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) listener(this.session, event);
  }

  /** Tests: sign in without a code (no network call logged). */
  signInAs(email: string): BackendSession {
    this.session = { userId: this.cloud.userId(email), email };
    return this.session;
  }

  /** Tests: the server ends the session (e.g. a revoked refresh token). */
  revokeSession(): void {
    this.session = null;
    this.emit('signedOut');
  }

  async hasStoredSession() {
    return this.session !== null;
  }

  async getSession() {
    return this.session;
  }

  onSessionChange(listener: (s: BackendSession | null, e: SessionEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async requestCode(email: string) {
    this.cloud.call('requestCode');
    if (!email.includes('@')) throw new BackendError('unknown', 'email_address_invalid');
  }

  async verifyCode(email: string, code: string) {
    this.cloud.call('verifyCode');
    if (code !== FAKE_CODE) throw new BackendError('invalidCode', 'otp_expired');
    this.signInAs(email);
    this.emit('signedIn');
    return this.session as BackendSession;
  }

  async signOut() {
    this.cloud.call('signOut');
    this.session = null;
    this.emit('signedOut');
  }

  async memberships() {
    const userId = this.me('memberships');
    return [...this.cloud.teams].flatMap(([teamId, team]) => {
      const m = team.members.get(userId);
      return m ? [{ teamId, role: m.role }] : [];
    });
  }

  async teamNames(teamIds: readonly string[]) {
    const userId = this.me('teamNames');
    const names: Record<string, string> = {};
    for (const teamId of teamIds) {
      if (!this.cloud.role(teamId, userId)) continue;
      const row = this.cloud.record(teamId, 'team', teamId);
      const name = (row?.payload as { name?: unknown } | null)?.name;
      if (typeof name === 'string') names[teamId] = name;
    }
    return names;
  }

  async createTeam(teamId: string, displayName: string) {
    const userId = this.me('createTeam');
    if (this.cloud.teams.has(teamId)) return this.cloud.role(teamId, userId) ? 'member' : 'taken';
    if (this.cloud.photoCount(teamId) > 0) return 'taken';
    const created = [...this.cloud.teams.values()].filter((t) => t.createdBy === userId).length;
    if (created >= 10) throw sqlError('VL006', 'tooMany');
    this.cloud.teams.set(teamId, {
      createdBy: userId,
      members: new Map([[userId, { role: 'manager', displayName, joinedAt: this.now }]]),
      records: new Map(),
      removals: new Map(),
    });
    return 'created' as const;
  }

  async pushRecords(teamId: string, deviceId: string, items: readonly PushItem[]) {
    this.manager('pushRecords', teamId);
    if (items.length > 200) throw sqlError('22023', 'unknown');
    const team = this.cloud.team(teamId);
    return items.map((item): PushOutcome => {
      const key = `${item.kind}:${item.id}`;
      const at = Math.min(Date.parse(item.at), this.now + 60_000);
      const old = team.records.get(key);
      const later = !old || at > old.at || (at === old.at && deviceId > old.deviceId);
      if (!later) {
        return {
          ...this.outcome(old, false),
          payload: (old.payload ?? null) as PushOutcome['payload'],
        };
      }
      this.cloud.version += 1;
      const row: Row = {
        kind: item.kind,
        id: item.id,
        payload: item.deleted ? null : JSON.parse(JSON.stringify(item.payload)),
        deleted: !!item.deleted,
        at,
        updatedAt: this.now,
        version: this.cloud.version,
        deviceId,
      };
      team.records.set(key, row);
      return this.outcome(row, true);
    });
  }

  private outcome(row: Row, applied: boolean): PushOutcome {
    return {
      kind: row.kind,
      id: row.id,
      applied,
      version: row.version,
      at: iso(row.at),
      updatedAt: iso(row.updatedAt),
      deleted: row.deleted,
      deviceId: row.deviceId,
    };
  }

  async pullChanges(teamId: string, after: number, limit: number) {
    const userId = this.me('pullChanges');
    const team = this.cloud.teams.get(teamId);
    const rows =
      team && team.members.has(userId)
        ? [...team.records.values()]
            .filter((r) => r.version > after)
            .sort((a, b) => a.version - b.version)
            .slice(0, limit)
            .map((r) => ({
              kind: r.kind,
              id: r.id,
              payload: r.payload,
              deleted: r.deleted,
              at: iso(r.at),
              updated_at: iso(r.updatedAt),
              version: r.version,
              device_id: r.deviceId,
            }))
        : [];
    return { serverNow: iso(this.now), rows };
  }

  async leaveTeam(teamId: string) {
    const userId = this.member('leaveTeam', teamId);
    const team = this.cloud.team(teamId);
    if (team.members.size === 1) throw sqlError('VL004', 'lastMember');
    this.dropMember(teamId, userId);
  }

  private dropMember(teamId: string, userId: string): void {
    const team = this.cloud.team(teamId);
    const m = team.members.get(userId);
    const managers = [...team.members.values()].filter((x) => x.role === 'manager').length;
    if (m?.role === 'manager' && managers === 1 && team.members.size > 1) {
      throw sqlError('VL001', 'lastManager');
    }
    team.members.delete(userId);
    for (const [key, hold] of this.cloud.holds) {
      if (hold.teamId === teamId && hold.userId === userId) this.cloud.holds.delete(key);
    }
  }

  async deleteTeam(teamId: string) {
    this.manager('deleteTeam', teamId);
    if (this.cloud.photoCount(teamId) > 0) throw sqlError('VL008', 'unknown');
    this.removeTeam(teamId);
  }

  private removeTeam(teamId: string): void {
    this.cloud.teams.delete(teamId);
    this.cloud.invites = this.cloud.invites.filter((i) => i.teamId !== teamId);
    for (const [key, hold] of this.cloud.holds)
      if (hold.teamId === teamId) this.cloud.holds.delete(key);
  }

  async listMembers(teamId: string): Promise<MemberRow[]> {
    this.member('listMembers', teamId);
    return [...this.cloud.team(teamId).members].map(([userId, m]) => ({
      userId,
      displayName: m.displayName,
      role: m.role,
      joinedAt: iso(m.joinedAt),
    }));
  }

  async setMemberRole(teamId: string, userId: string, role: TeamRole) {
    this.manager('setMemberRole', teamId);
    const team = this.cloud.team(teamId);
    const m = team.members.get(userId);
    if (!m || m.role === role) return;
    const managers = [...team.members.values()].filter((x) => x.role === 'manager').length;
    if (m.role === 'manager' && managers === 1) throw sqlError('VL001', 'lastManager');
    m.role = role;
    if (role !== 'manager') {
      for (const [key, hold] of this.cloud.holds) {
        if (hold.teamId === teamId && hold.userId === userId) this.cloud.holds.delete(key);
      }
    }
  }

  async removeMember(teamId: string, userId: string) {
    this.manager('removeMember', teamId);
    const team = this.cloud.team(teamId);
    if (![...team.members.keys()].some((id) => id !== userId)) {
      throw sqlError('VL004', 'lastMember');
    }
    if (!team.members.has(userId)) return;
    this.dropMember(teamId, userId);
    team.removals.set(userId, this.now);
  }

  private toInvite(i: FakeInvite): Invite {
    return {
      id: i.id,
      code: i.code,
      role: i.role,
      expiresAt: iso(i.expiresAt),
      revokedAt: i.revokedAt === null ? null : iso(i.revokedAt),
      uses: i.uses,
    };
  }

  async listInvites(teamId: string) {
    this.manager('listInvites', teamId);
    return this.cloud.invites.filter((i) => i.teamId === teamId).map((i) => this.toInvite(i));
  }

  async createInvite(teamId: string, role: TeamRole, days: number) {
    this.manager('createInvite', teamId);
    if (days < 1 || days > (role === 'manager' ? 7 : 30)) throw sqlError('22023', 'unknown');
    const invite: FakeInvite = {
      id: this.cloud.id('invite'),
      teamId,
      code: inviteCode(this.cloud.invites.length + 1),
      role,
      createdAt: this.now,
      expiresAt: this.now + days * 86_400_000,
      revokedAt: null,
      uses: 0,
      maxUses: role === 'manager' ? 1 : null,
    };
    this.cloud.invites.push(invite);
    return this.toInvite(invite);
  }

  async revokeInvite(inviteId: string) {
    const invite = this.cloud.invites.find((i) => i.id === inviteId);
    if (!invite) {
      this.me('revokeInvite');
      throw sqlError('42501', 'forbidden');
    }
    this.manager('revokeInvite', invite.teamId);
    invite.revokedAt ??= this.now;
  }

  async joinTeam(code: string, displayName: string) {
    const userId = this.me('joinTeam');
    const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const invite = this.cloud.invites.find(
      (i) => i.code === clean && i.revokedAt === null && i.expiresAt > this.now,
    );
    const team = invite ? this.cloud.teams.get(invite.teamId) : undefined;
    const removedAt = invite ? team?.removals.get(userId) : undefined;
    if (
      !invite ||
      !team ||
      (invite.maxUses !== null && invite.uses >= invite.maxUses) ||
      (removedAt !== undefined && removedAt >= invite.createdAt)
    ) {
      throw sqlError('VL002', 'inviteInvalid');
    }
    const old = team.members.get(userId);
    const role: TeamRole = invite.role === 'manager' ? 'manager' : (old?.role ?? 'player');
    team.members.set(userId, {
      role,
      displayName: displayName || old?.displayName || '',
      joinedAt: old?.joinedAt ?? this.now,
    });
    invite.uses += 1;
    team.removals.delete(userId);
    return { teamId: invite.teamId, role };
  }

  async listHolds(teamIds: readonly string[]) {
    const userId = this.me('listHolds');
    return [...this.cloud.holds.values()]
      .filter((h) => teamIds.includes(h.teamId) && this.cloud.role(h.teamId, userId))
      .map(({ until: _until, ...hold }) => hold);
  }

  async holdMatch(
    teamId: string,
    matchId: string,
    deviceId: string,
    holderName: string,
    takeOver: boolean,
  ): Promise<HoldResult> {
    const userId = this.manager('holdMatch', teamId);
    const key = `${teamId}/${matchId}`;
    const old = this.cloud.holds.get(key);
    if (old && old.deviceId !== deviceId && old.until > this.now && !takeOver) {
      return { granted: false, holderName: old.holderName, heldUntil: old.heldUntil };
    }
    const until = this.now + 15 * 60_000;
    const hold: FakeHold = {
      matchId,
      teamId,
      deviceId,
      userId,
      holderName,
      heldUntil: iso(until),
      until,
    };
    this.cloud.holds.set(key, hold);
    return { granted: true, holderName, heldUntil: hold.heldUntil };
  }

  async releaseMatch(teamId: string, matchId: string, deviceId: string) {
    this.manager('releaseMatch', teamId);
    const key = `${teamId}/${matchId}`;
    if (this.cloud.holds.get(key)?.deviceId === deviceId) this.cloud.holds.delete(key);
  }

  async uploadPhoto(teamId: string, photoId: string, dataUri: string) {
    this.manager('uploadPhoto', teamId);
    const key = `${teamId}/${photoId}`;
    if (!this.cloud.photos.has(key)) this.cloud.photos.set(key, dataUri);
  }

  async downloadPhoto(teamId: string, photoId: string) {
    this.member('downloadPhoto', teamId);
    const key = `${teamId}/${photoId}`;
    const uri = this.cloud.photos.get(key);
    if (uri === undefined || this.cloud.brokenPhotos.has(key)) {
      throw new BackendError('unknown', 'not_found');
    }
    return uri;
  }

  async listPhotos(teamId: string) {
    this.me('listPhotos');
    if (!this.cloud.role(teamId, this.session?.userId ?? '')) return [];
    return [...this.cloud.photos.keys()]
      .filter((k) => k.startsWith(`${teamId}/`))
      .map((k) => k.slice(teamId.length + 1));
  }

  async removePhotos(teamId: string, photoIds: readonly string[]) {
    this.me('removePhotos');
    // Like Storage: objects the policy doesn't allow are skipped silently.
    if (this.cloud.role(teamId, this.session?.userId ?? '') !== 'manager') return;
    for (const id of photoIds) this.cloud.photos.delete(`${teamId}/${id}`);
  }

  private soleAndBlocked(userId: string): { sole: string[]; blocked: string[] } {
    const sole: string[] = [];
    const blocked: string[] = [];
    for (const [teamId, team] of this.cloud.teams) {
      const m = team.members.get(userId);
      if (!m) continue;
      const others = [...team.members].filter(([id]) => id !== userId);
      if (others.length === 0) sole.push(teamId);
      else if (m.role === 'manager' && !others.some(([, o]) => o.role === 'manager')) {
        blocked.push(teamId);
      }
    }
    return { sole, blocked };
  }

  async deletionCheck() {
    const userId = this.me('deletionCheck');
    const { sole, blocked } = this.soleAndBlocked(userId);
    return { deleteTeams: sole, blockedTeams: blocked };
  }

  async deleteAccount() {
    const userId = this.me('deleteAccount');
    const { sole, blocked } = this.soleAndBlocked(userId);
    if (blocked.length > 0) throw sqlError('VL001', 'lastManager');
    if (sole.some((teamId) => this.cloud.photoCount(teamId) > 0)) {
      throw sqlError('VL008', 'unknown');
    }
    for (const teamId of sole) this.removeTeam(teamId);
    for (const team of this.cloud.teams.values()) team.members.delete(userId);
    this.cloud.deletedUsers.add(userId);
    return sole;
  }
}
