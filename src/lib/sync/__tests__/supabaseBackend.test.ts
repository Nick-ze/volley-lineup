/**
 * v10: the Supabase `SyncBackend` against a mockClient supabase-js client — the RPC names and
 * arguments of `supabase/migrations`, how answers are mapped and checked, and errors.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { BackendSession, SessionEvent } from '../backend';
import { BackendError } from '../errors';
import { createSupabaseBackend } from '../supabaseBackend';

type Result = { data: unknown; error: unknown; status?: number };

let authListener: ((event: string, session: unknown) => void) | null = null;

jest.mock('../client', () => ({
  hasStoredSession: jest.fn(async () => true),
  whenClientCreated: (fn: (c: unknown) => void) => fn(mockClient),
}));

/** A query builder: every filter returns itself; awaiting it gives `result`. */
function query(result: Result) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {
    calls,
    then: (ok: (r: Result) => unknown, fail: (e: unknown) => unknown) =>
      Promise.resolve(result).then(ok, fail),
  };
  for (const name of ['select', 'eq', 'in', 'order']) {
    builder[name] = (...args: unknown[]) => {
      calls.push([name, args]);
      return builder;
    };
  }
  return builder;
}

const user = { id: 'u1', email: 'anna@example.test' };
const ok = (data: unknown): Result => ({ data, error: null, status: 200 });

const mockClient = {
  rpc: jest.fn(async (): Promise<Result> => ok(null)),
  from: jest.fn(() => query(ok([]))),
  storage: {
    from: jest.fn(() => bucket),
  },
  auth: {
    getSession: jest.fn(
      async (): Promise<{ data: { session: { user: typeof user } | null }; error: unknown }> => ({
        data: { session: { user } },
        error: null,
      }),
    ),
    onAuthStateChange: jest.fn((fn: (event: string, session: unknown) => void) => {
      authListener = fn;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
    signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
    verifyOtp: jest.fn(async () => ({ data: { session: { user }, user }, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
  },
};

const bucket = {
  upload: jest.fn(async () => ({ data: {}, error: null as unknown })),
  download: jest.fn(async (): Promise<Result> => ok(null)),
  list: jest.fn(async (): Promise<Result> => ok([])),
  remove: jest.fn(async (): Promise<Result> => ok([])),
};

const backend = createSupabaseBackend(() => mockClient as unknown as SupabaseClient);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('supabase backend: records', () => {
  it('push_records: arguments and results (stale rows keep their payload)', async () => {
    mockClient.rpc.mockResolvedValueOnce(
      ok([
        {
          kind: 'player',
          id: 'p1',
          applied: true,
          version: 5,
          at: '2026-01-01T10:00:00.000Z',
          updated_at: '2026-01-01T10:00:01.000Z',
          deleted: false,
          device_id: 'dev',
        },
        {
          kind: 'team',
          id: 't1',
          applied: false,
          version: 6,
          at: '2026-01-01T10:00:00.5+00:00',
          updated_at: '2026-01-01T10:00:01.000Z',
          deleted: false,
          device_id: 'other',
          payload: { name: 'X' },
        },
      ]),
    );
    const items = [{ kind: 'player' as const, id: 'p1', at: '2026-01-01T10:00:00.000Z' }];
    const results = await backend.pushRecords('t1', 'dev', items);
    expect(mockClient.rpc).toHaveBeenCalledWith('push_records', {
      p_team_id: 't1',
      p_device_id: 'dev',
      p_records: items,
    });
    expect(results).toEqual([
      {
        kind: 'player',
        id: 'p1',
        applied: true,
        version: 5,
        at: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:01.000Z',
        deleted: false,
        deviceId: 'dev',
      },
      {
        kind: 'team',
        id: 't1',
        applied: false,
        version: 6,
        at: '2026-01-01T10:00:00.500Z',
        updatedAt: '2026-01-01T10:00:01.000Z',
        deleted: false,
        deviceId: 'other',
        payload: { name: 'X' },
      },
    ]);
  });

  it('pull_changes and create_team', async () => {
    mockClient.rpc.mockResolvedValueOnce(ok({ server_now: 'now', rows: [{ a: 1 }] }));
    expect(await backend.pullChanges('t1', 7, 500)).toEqual({ serverNow: 'now', rows: [{ a: 1 }] });
    expect(mockClient.rpc).toHaveBeenCalledWith('pull_changes', {
      p_team_id: 't1',
      p_after: 7,
      p_limit: 500,
    });
    mockClient.rpc.mockResolvedValueOnce(ok('taken'));
    expect(await backend.createTeam('t1', 'Coach')).toBe('taken');
    expect(mockClient.rpc).toHaveBeenLastCalledWith('create_team', {
      p_team_id: 't1',
      p_display_name: 'Coach',
    });
  });

  it('an SQL error becomes a BackendError with its raw code; a malformed answer is unknown', async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'VL008', message: 'photos_remain', details: 't1' },
      status: 400,
    });
    await expect(backend.deleteTeam('t1')).rejects.toMatchObject({ code: 'unknown', raw: 'VL008' });
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'paused' }, status: 540 });
    await expect(backend.leaveTeam('t1')).rejects.toMatchObject({ code: 'offline' });
    mockClient.rpc.mockResolvedValueOnce(ok('nonsense'));
    await expect(backend.createTeam('t1', '')).rejects.toBeInstanceOf(BackendError);
  });

  it('memberships and team names (from the team records)', async () => {
    mockClient.from.mockReturnValueOnce(query(ok([{ team_id: 't1', role: 'player' }])));
    expect(await backend.memberships()).toEqual([{ teamId: 't1', role: 'player' }]);
    expect(mockClient.from).toHaveBeenLastCalledWith('team_members');
    mockClient.from.mockReturnValueOnce(
      query(
        ok([
          { team_id: 't1', name: 'Herren' },
          { team_id: 't2', name: null },
        ]),
      ),
    );
    expect(await backend.teamNames(['t1', 't2'])).toEqual({ t1: 'Herren' });
    expect(await backend.teamNames([])).toEqual({});
    mockClient.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(backend.memberships()).rejects.toMatchObject({ code: 'notSignedIn' });
  });
});

describe('supabase backend: members, invites, holds, account', () => {
  it('lists members and invites; creates, revokes, joins', async () => {
    mockClient.from.mockReturnValueOnce(
      query(
        ok([
          {
            user_id: 'u1',
            display_name: 'Anna',
            role: 'manager',
            joined_at: '2026-01-01T00:00:00+00:00',
          },
        ]),
      ),
    );
    expect(await backend.listMembers('t1')).toEqual([
      { userId: 'u1', displayName: 'Anna', role: 'manager', joinedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const invite = {
      id: 'i1',
      code: 'ABCDEFGHJK',
      role: 'player',
      expires_at: '2026-02-01T00:00:00.000Z',
      revoked_at: null,
      uses: 2,
    };
    mockClient.from.mockReturnValueOnce(query(ok([invite])));
    expect(await backend.listInvites('t1')).toEqual([
      {
        id: 'i1',
        code: 'ABCDEFGHJK',
        role: 'player',
        expiresAt: '2026-02-01T00:00:00.000Z',
        revokedAt: null,
        uses: 2,
      },
    ]);
    mockClient.rpc.mockResolvedValueOnce(
      ok({
        id: 'i2',
        code: 'ABCDEFGHJK',
        role: 'manager',
        expires_at: '2026-02-01T00:00:00Z',
        max_uses: 1,
      }),
    );
    expect(await backend.createInvite('t1', 'manager', 3)).toMatchObject({
      id: 'i2',
      uses: 0,
      revokedAt: null,
    });
    expect(mockClient.rpc).toHaveBeenLastCalledWith('create_invite', {
      p_team_id: 't1',
      p_role: 'manager',
      p_days: 3,
    });
    await backend.revokeInvite('i2');
    expect(mockClient.rpc).toHaveBeenLastCalledWith('revoke_invite', { p_invite_id: 'i2' });
    mockClient.rpc.mockResolvedValueOnce(ok({ team_id: 't1', role: 'player' }));
    expect(await backend.joinTeam('abcde-fghjk', 'Ben')).toEqual({ teamId: 't1', role: 'player' });
    await backend.setMemberRole('t1', 'u2', 'manager');
    expect(mockClient.rpc).toHaveBeenLastCalledWith('set_member_role', {
      p_team_id: 't1',
      p_user_id: 'u2',
      p_role: 'manager',
    });
    await backend.removeMember('t1', 'u2');
    expect(mockClient.rpc).toHaveBeenLastCalledWith('remove_member', {
      p_team_id: 't1',
      p_user_id: 'u2',
    });
  });

  it('holds: list, claim, release', async () => {
    mockClient.from.mockReturnValueOnce(
      query(
        ok([
          {
            team_id: 't1',
            match_id: 'm1',
            user_id: null,
            device_id: 'd',
            holder_name: 'Anna',
            held_until: '2026-01-01T10:15:00.123456+00:00',
          },
        ]),
      ),
    );
    expect(await backend.listHolds(['t1'])).toEqual([
      {
        matchId: 'm1',
        teamId: 't1',
        deviceId: 'd',
        userId: '',
        holderName: 'Anna',
        heldUntil: '2026-01-01T10:15:00.123Z',
      },
    ]);
    expect(await backend.listHolds([])).toEqual([]);
    mockClient.rpc.mockResolvedValueOnce(
      ok({ granted: false, holder_name: 'Ben', held_until: null }),
    );
    expect(await backend.holdMatch('t1', 'm1', 'd', 'Anna', true)).toEqual({
      granted: false,
      holderName: 'Ben',
      heldUntil: '',
    });
    expect(mockClient.rpc).toHaveBeenLastCalledWith('hold_match', {
      p_team_id: 't1',
      p_match_id: 'm1',
      p_device_id: 'd',
      p_holder_name: 'Anna',
      p_take_over: true,
    });
    await backend.releaseMatch('t1', 'm1', 'd');
    expect(mockClient.rpc).toHaveBeenLastCalledWith('release_match', {
      p_team_id: 't1',
      p_match_id: 'm1',
      p_device_id: 'd',
    });
  });

  it('account deletion check and delete', async () => {
    mockClient.rpc.mockResolvedValueOnce(ok({ delete_teams: ['t1'], blocked_teams: [] }));
    expect(await backend.deletionCheck()).toEqual({ deleteTeams: ['t1'], blockedTeams: [] });
    mockClient.rpc.mockResolvedValueOnce(ok(['t1']));
    expect(await backend.deleteAccount()).toEqual(['t1']);
    expect(mockClient.rpc).toHaveBeenLastCalledWith('delete_my_account', {});
  });
});

describe('supabase backend: photos', () => {
  it('uploads bytes with the type; "already exists" counts as uploaded', async () => {
    await backend.uploadPhoto('t1', 'ph1', 'data:image/png;base64,iVBORw0KGgo=');
    expect(bucket.upload).toHaveBeenCalledWith('t1/ph1', expect.any(Uint8Array), {
      contentType: 'image/png',
      upsert: false,
    });
    bucket.upload.mockResolvedValueOnce({ data: {}, error: { statusCode: '409', message: 'x' } });
    await expect(
      backend.uploadPhoto('t1', 'ph1', 'data:image/png;base64,iVBORw0KGgo='),
    ).resolves.toBeUndefined();
    bucket.upload.mockResolvedValueOnce({ data: {}, error: { status: 413, message: 'too big' } });
    await expect(
      backend.uploadPhoto('t1', 'ph1', 'data:image/png;base64,iVBORw0KGgo='),
    ).rejects.toMatchObject({ code: 'unknown' });
    await expect(backend.uploadPhoto('t1', 'ph1', 'not a photo')).rejects.toBeInstanceOf(
      BackendError,
    );
  });

  it('lists every page (hidden placeholders left out) and removes in chunks', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ name: `p${i}` }));
    bucket.list
      .mockResolvedValueOnce(ok(page))
      .mockResolvedValueOnce(ok([{ name: 'last' }, { name: '.emptyFolderPlaceholder' }]));
    const ids = await backend.listPhotos('t1');
    expect(ids).toHaveLength(1001);
    expect(bucket.list).toHaveBeenLastCalledWith('t1', { limit: 1000, offset: 1000 });
    await backend.removePhotos('t1', ids);
    expect(bucket.remove).toHaveBeenCalledTimes(2);
    expect(bucket.remove).toHaveBeenLastCalledWith(['t1/last']);
  });

  it('downloads a photo as a data URI (and refuses what isn’t one)', async () => {
    class Reader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error = null;
      readAsDataURL() {
        this.result = 'data:application/octet-stream;base64,iVBORw0KGgo=';
        this.onload?.();
      }
    }
    (globalThis as { FileReader?: unknown }).FileReader = Reader;
    bucket.download.mockResolvedValueOnce(ok(new Blob(['x'])));
    expect(await backend.downloadPhoto('t1', 'ph1')).toBe('data:image/png;base64,iVBORw0KGgo=');
    bucket.download.mockResolvedValueOnce(ok('not a blob'));
    await expect(backend.downloadPhoto('t1', 'ph1')).rejects.toBeInstanceOf(BackendError);
    delete (globalThis as { FileReader?: unknown }).FileReader;
  });
});

describe('supabase backend: auth', () => {
  it('code sign-in, session, local sign-out and session events', async () => {
    expect(await backend.hasStoredSession()).toBe(true);
    await backend.requestCode('anna@example.test');
    expect(mockClient.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'anna@example.test',
      options: { shouldCreateUser: true },
    });
    expect(await backend.verifyCode('anna@example.test', '123456')).toEqual({
      userId: 'u1',
      email: 'anna@example.test',
    });
    expect(mockClient.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'anna@example.test',
      token: '123456',
      type: 'email',
    });
    expect(await backend.getSession()).toEqual({ userId: 'u1', email: 'anna@example.test' });
    await backend.signOut();
    expect(mockClient.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    jest.useFakeTimers();
    const seen: [BackendSession | null, SessionEvent][] = [];
    const stop = backend.onSessionChange((s, e) => seen.push([s, e]));
    authListener?.('SIGNED_IN', { user });
    authListener?.('TOKEN_REFRESHED', { user });
    authListener?.('SIGNED_OUT', null);
    jest.runAllTimers();
    jest.useRealTimers();
    expect(seen).toEqual([
      [{ userId: 'u1', email: 'anna@example.test' }, 'signedIn'],
      [{ userId: 'u1', email: 'anna@example.test' }, 'other'],
      [null, 'signedOut'],
    ]);
    stop();
  });

  it('maps auth errors', async () => {
    mockClient.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthApiError', code: 'otp_expired', status: 403 },
    } as never);
    await expect(backend.verifyCode('a@b.c', '000000')).rejects.toMatchObject({
      code: 'invalidCode',
    });
    mockClient.auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: { code: 'over_email_send_rate_limit', status: 429 },
    } as never);
    await expect(backend.requestCode('a@b.c')).rejects.toMatchObject({ code: 'rateLimited' });
    mockClient.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { code: 'refresh_token_not_found', status: 400 },
    } as never);
    await expect(backend.getSession()).rejects.toMatchObject({ code: 'signedOut' });
    mockClient.auth.verifyOtp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    } as never);
    await expect(backend.verifyCode('a@b.c', '1')).rejects.toMatchObject({ code: 'invalidCode' });
  });
});
