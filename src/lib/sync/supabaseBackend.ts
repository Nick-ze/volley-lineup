/**
 * v10: `SyncBackend` on Supabase (docs/SUPABASE.md): the RPCs of `supabase/migrations`, the
 * private bucket `team-photos` (`<teamId>/<photoId>`) and email-code sign-in. Server answers are
 * checked before use; every failure becomes a `BackendError`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { PushOutcome } from '@/domain/syncMerge';
import { RECORD_KINDS, type RecordPayload } from '@/domain/syncRecords';
import { normalizeTimestamp } from '@/domain/syncSchema';
import type { MatchHold } from '@/domain/types';

import type { BackendSession, SyncBackend } from './backend';
import { hasStoredSession, whenClientCreated } from './client';
import { BackendError, backendError } from './errors';
import { blobToBytes, bytesToDataUri, dataUriToBytes } from './photoData';
import type { Invite } from './types';

export const PHOTO_BUCKET = 'team-photos';

interface Response {
  data: unknown;
  error: unknown;
  status?: number;
}

/** The data of a supabase-js response, or a `BackendError`. */
async function data(request: PromiseLike<Response>): Promise<unknown> {
  const { data: value, error, status } = await request;
  if (error) {
    const fields = typeof error === 'object' ? error : { message: String(error) };
    throw backendError(status === undefined ? fields : { status, ...fields });
  }
  return value;
}

/** Parses a server answer; a malformed one is an `unknown` error. */
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BackendError('unknown', 'shape');
  return result.data;
}

const time = z.string().transform((value) => normalizeTimestamp(value) ?? value);
const role = z.enum(['manager', 'player']);

const pushResults = z.array(
  z.object({
    kind: z.enum(RECORD_KINDS),
    id: z.string(),
    applied: z.boolean(),
    version: z.number(),
    at: time,
    updated_at: time,
    deleted: z.boolean(),
    device_id: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
);

const inviteRow = z.object({
  id: z.string(),
  code: z.string(),
  role,
  expires_at: time,
  revoked_at: time.nullable().optional(),
  uses: z.number().optional(),
  max_uses: z.number().nullable().optional(),
});

const toInvite = (row: z.infer<typeof inviteRow>): Invite => ({
  id: row.id,
  code: row.code,
  role: row.role,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at ?? null,
  uses: row.uses ?? 0,
  maxUses: row.max_uses ?? null,
});

const sessionOf = (user: { id: string; email?: string } | null | undefined) =>
  user ? { userId: user.id, email: user.email ?? '' } : null;

export function createSupabaseBackend(client: () => SupabaseClient): SyncBackend {
  const rpc = (fn: string, args: Record<string, unknown> = {}) => data(client().rpc(fn, args));
  const bucket = () => client().storage.from(PHOTO_BUCKET);

  return {
    hasStoredSession,

    async getSession() {
      const result = await client().auth.getSession();
      if (result.error) throw backendError(result.error);
      return sessionOf(result.data.session?.user);
    },

    onSessionChange(listener) {
      let unsubscribe: (() => void) | null = null;
      let stopped = false;
      whenClientCreated((c) => {
        if (stopped) return;
        const { data: sub } = c.auth.onAuthStateChange((event, session) => {
          const kind =
            event === 'SIGNED_OUT' ? 'signedOut' : event === 'SIGNED_IN' ? 'signedIn' : 'other';
          // supabase-js holds a lock while it calls listeners: react after it returns.
          setTimeout(() => listener(sessionOf(session?.user), kind), 0);
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      });
      return () => {
        stopped = true;
        unsubscribe?.();
      };
    },

    async requestCode(email) {
      const { error } = await client().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw backendError(error);
    },

    async verifyCode(email, code): Promise<BackendSession> {
      const { data: result, error } = await client().auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      if (error) throw backendError(error);
      const session = sessionOf(result.session?.user ?? result.user);
      if (!session) throw new BackendError('invalidCode');
      return session;
    },

    async signOut() {
      // Local scope: other devices stay signed in. The stored session is cleared even when the
      // server can't be reached.
      await client().auth.signOut({ scope: 'local' });
    },

    async memberships() {
      const { data: auth } = await client().auth.getSession();
      const userId = auth.session?.user.id;
      if (!userId) throw new BackendError('notSignedIn');
      const rows = await data(
        client().from('team_members').select('team_id, role').eq('user_id', userId),
      );
      return parse(z.array(z.object({ team_id: z.string(), role })), rows).map((r) => ({
        teamId: r.team_id,
        role: r.role,
      }));
    },

    async teamNames(teamIds) {
      if (teamIds.length === 0) return {};
      const rows = await data(
        client()
          .from('team_records')
          .select('team_id, name:payload->>name')
          .eq('kind', 'team')
          .in('team_id', [...teamIds]),
      );
      const list = parse(
        z.array(z.object({ team_id: z.string(), name: z.string().nullable() })),
        rows,
      );
      return Object.fromEntries(list.flatMap((r) => (r.name ? [[r.team_id, r.name]] : [])));
    },

    async createTeam(teamId, displayName) {
      const result = await rpc('create_team', { p_team_id: teamId, p_display_name: displayName });
      return parse(z.enum(['created', 'member', 'taken']), result);
    },

    async pushRecords(teamId, deviceId, items): Promise<PushOutcome[]> {
      const result = await rpc('push_records', {
        p_team_id: teamId,
        p_device_id: deviceId,
        p_records: items,
      });
      return parse(pushResults, result).map((r) => ({
        kind: r.kind,
        id: r.id,
        applied: r.applied,
        version: r.version,
        at: r.at,
        updatedAt: r.updated_at,
        deleted: r.deleted,
        ...(r.device_id === undefined ? {} : { deviceId: r.device_id }),
        ...(r.applied ? {} : { payload: (r.payload ?? null) as RecordPayload | null }),
      }));
    },

    async pullChanges(teamId, after, limit) {
      const result = await rpc('pull_changes', {
        p_team_id: teamId,
        p_after: after,
        p_limit: limit,
      });
      const page = parse(z.object({ server_now: z.string(), rows: z.array(z.unknown()) }), result);
      return { serverNow: page.server_now, rows: page.rows };
    },

    async leaveTeam(teamId) {
      await rpc('leave_team', { p_team_id: teamId });
    },

    async deleteTeam(teamId) {
      await rpc('delete_team', { p_team_id: teamId });
    },

    async listMembers(teamId) {
      const rows = await data(
        client()
          .from('team_members')
          .select('user_id, display_name, role, joined_at')
          .eq('team_id', teamId)
          .order('joined_at'),
      );
      const schema = z.array(
        z.object({ user_id: z.string(), display_name: z.string(), role, joined_at: time }),
      );
      return parse(schema, rows).map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        role: r.role,
        joinedAt: r.joined_at,
      }));
    },

    async setMemberRole(teamId, userId, newRole) {
      await rpc('set_member_role', { p_team_id: teamId, p_user_id: userId, p_role: newRole });
    },

    async removeMember(teamId, userId) {
      await rpc('remove_member', { p_team_id: teamId, p_user_id: userId });
    },

    async listInvites(teamId) {
      const rows = await data(
        client()
          .from('invites')
          .select('id, code, role, expires_at, revoked_at, uses, max_uses')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false }),
      );
      return parse(z.array(inviteRow), rows).map(toInvite);
    },

    async createInvite(teamId, inviteRole, days) {
      const result = await rpc('create_invite', {
        p_team_id: teamId,
        p_role: inviteRole,
        p_days: days,
      });
      return toInvite(parse(inviteRow, result));
    },

    async revokeInvite(inviteId) {
      await rpc('revoke_invite', { p_invite_id: inviteId });
    },

    async joinTeam(code, displayName) {
      const result = await rpc('join_team', { p_code: code, p_display_name: displayName });
      const joined = parse(z.object({ team_id: z.string(), role }), result);
      return { teamId: joined.team_id, role: joined.role };
    },

    async listHolds(teamIds): Promise<MatchHold[]> {
      if (teamIds.length === 0) return [];
      const rows = await data(
        client()
          .from('match_holds')
          .select('team_id, match_id, user_id, device_id, holder_name, held_until')
          .in('team_id', [...teamIds]),
      );
      const schema = z.array(
        z.object({
          team_id: z.string(),
          match_id: z.string(),
          user_id: z.string().nullable(),
          device_id: z.string(),
          holder_name: z.string(),
          held_until: time,
        }),
      );
      return parse(schema, rows).map((r) => ({
        matchId: r.match_id,
        teamId: r.team_id,
        deviceId: r.device_id,
        userId: r.user_id ?? '',
        holderName: r.holder_name,
        heldUntil: r.held_until,
      }));
    },

    async holdMatch(teamId, matchId, deviceId, holderName, takeOver) {
      const result = await rpc('hold_match', {
        p_team_id: teamId,
        p_match_id: matchId,
        p_device_id: deviceId,
        p_holder_name: holderName,
        p_take_over: takeOver,
      });
      const hold = parse(
        z.object({
          granted: z.boolean(),
          holder_name: z.string().nullable(),
          held_until: time.nullable(),
        }),
        result,
      );
      return {
        granted: hold.granted,
        holderName: hold.holder_name ?? '',
        heldUntil: hold.held_until ?? '',
      };
    },

    async releaseMatch(teamId, matchId, deviceId) {
      await rpc('release_match', { p_team_id: teamId, p_match_id: matchId, p_device_id: deviceId });
    },

    async uploadPhoto(teamId, photoId, dataUri) {
      const photo = dataUriToBytes(dataUri);
      if (!photo) throw new BackendError('unknown', 'photo');
      const { error } = await bucket().upload(`${teamId}/${photoId}`, photo.bytes, {
        contentType: photo.contentType,
        upsert: false,
      });
      if (error && !isAlreadyThere(error)) throw backendError(error);
    },

    async downloadPhoto(teamId, photoId) {
      const { data: blob, error } = await bucket().download(`${teamId}/${photoId}`);
      if (error)
        throw isMissing(error) ? new BackendError('unknown', 'not_found') : backendError(error);
      if (!(blob instanceof Blob)) throw new BackendError('unknown', 'photo');
      const uri = bytesToDataUri(await blobToBytes(blob));
      if (!uri) throw new BackendError('unknown', 'photo');
      return uri;
    },

    async listPhotos(teamId) {
      const names: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const rows = await data(bucket().list(teamId, { limit: 1000, offset }));
        const page = parse(z.array(z.object({ name: z.string() })), rows);
        names.push(...page.map((r) => r.name).filter((n) => !n.startsWith('.')));
        if (page.length < 1000) return names;
      }
    },

    async removePhotos(teamId, photoIds) {
      for (let i = 0; i < photoIds.length; i += 1000) {
        const paths = photoIds.slice(i, i + 1000).map((id) => `${teamId}/${id}`);
        await data(bucket().remove(paths));
      }
    },

    async deletionCheck() {
      const result = await rpc('account_deletion_check');
      const check = parse(
        z.object({ delete_teams: z.array(z.string()), blocked_teams: z.array(z.string()) }),
        result,
      );
      return { deleteTeams: check.delete_teams, blockedTeams: check.blocked_teams };
    },

    async deleteAccount() {
      return parse(z.array(z.string()).nullable(), await rpc('delete_my_account')) ?? [];
    },
  };
}

/** Storage's "no such object". */
function isMissing(error: unknown): boolean {
  const e = error as { statusCode?: unknown; status?: unknown; code?: unknown; message?: unknown };
  return (
    String(e.statusCode) === '404' ||
    e.status === 404 ||
    e.code === 'NoSuchKey' ||
    /not found/i.test(String(e.message))
  );
}

/** Storage's "already exists" (an earlier upload of the same immutable photo went through). */
function isAlreadyThere(error: unknown): boolean {
  const e = error as { statusCode?: unknown; status?: unknown; code?: unknown; message?: unknown };
  return (
    String(e.statusCode) === '409' ||
    e.status === 409 ||
    e.code === 'ResourceAlreadyExists' ||
    /already exists|duplicate/i.test(String(e.message))
  );
}
