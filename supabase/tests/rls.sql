-- RLS and RPC tests for the v10 schema (T1–T33). See docs/SUPABASE.md.
--
-- Run as `postgres` on a database that has every file in supabase/migrations applied, e.g. the
-- Supabase SQL editor, psql, or the MCP tool `execute_sql`. Everything happens inside one
-- transaction that is rolled back at the end, so the script leaves nothing behind. It creates its
-- own users in auth.users (fixed ids, *@example.test).
--
-- A failing check raises an exception whose message starts with "FAIL T<n>"; the transaction
-- aborts there. When every check passes, the last result is 'ALL RLS TESTS PASSED'.
--
-- Users: MA (manager of team-a), MB (manager of team-b), PA (player of team-a), S (stranger).
-- Identities are switched with `reset role`, the JWT claims GUC and `set local role`.

begin;

-- ---------------------------------------------------------------------------------------------
-- Helpers (temporary, gone with the session)
-- ---------------------------------------------------------------------------------------------

create function pg_temp.check(p_ok boolean, p_test text) returns void
  language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'FAIL %', p_test;
  end if;
end $$;

-- Runs p_sql and expects it to fail with SQLSTATE p_state.
create function pg_temp.expect_error(p_test text, p_sql text, p_state text) returns void
  language plpgsql as $$
declare
  v_state text;
  v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    if v_state = p_state then
      return;
    end if;
    raise exception 'FAIL % (expected %, got %: %)', p_test, p_state, v_state, v_msg;
  end;
  raise exception 'FAIL % (expected %, but it succeeded)', p_test, p_state;
end $$;

-- Sets the JWT claims for the next `set local role authenticated`.
create function pg_temp.as_user(p_user uuid) returns void
  language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- ---------------------------------------------------------------------------------------------
-- Setup (postgres)
-- ---------------------------------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
from (values ('a0000000-0000-4000-8000-000000000001'::uuid, 'rls-ma@example.test'),
             ('a0000000-0000-4000-8000-000000000002'::uuid, 'rls-mb@example.test'),
             ('a0000000-0000-4000-8000-000000000003'::uuid, 'rls-pa@example.test'),
             ('a0000000-0000-4000-8000-000000000004'::uuid, 'rls-s@example.test')) u (id, email);

-- ---------------------------------------------------------------------------------------------
-- T1 create teams
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.create_team('team-a', 'Anna') = 'created', 'T1 MA creates team-a');
  perform pg_temp.check(public.create_team('team-a', 'Anna') = 'member', 'T1 MA re-creates team-a: member');
  perform pg_temp.check((select array_agg(id) from public.teams) = array['team-a'], 'T1 MA reads only team-a');
  perform pg_temp.check((select role from public.team_members where team_id = 'team-a') = 'manager', 'T1 MA is manager');
  perform pg_temp.check((select display_name from public.team_members where team_id = 'team-a') = 'Anna', 'T1 display name');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.create_team('team-b', 'Ben') = 'created', 'T1 MB creates team-b');
  perform pg_temp.check((select array_agg(id) from public.teams) = array['team-b'], 'T1 MB reads only team-b');
  perform public.push_records('team-b', 'devB',
    '[{"kind":"team","id":"team-b","at":"2026-01-01T10:00:00Z","payload":{"name":"B"}}]');
  perform pg_temp.check((select count(*) from public.team_records) = 1, 'T1 MB reads its record');
  perform pg_temp.expect_error('T1 bad team id', $q$select public.create_team('a/b', 'x')$q$, '23514');
  perform pg_temp.expect_error('T1 dots-only team id', $q$select public.create_team('..', 'x')$q$, '23514');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T2 push and pull
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  r jsonb;
  p jsonb;
begin
  r := public.push_records('team-a', 'dev1', '[
    {"kind":"team","id":"team-a","at":"2026-01-01T10:00:00Z","payload":{"name":"A"}},
    {"kind":"player","id":"p1","at":"2026-01-01T10:00:00Z","payload":{"name":"Pia","number":7}},
    {"kind":"set","id":"m1/1","at":"2026-01-01T10:00:00Z","payload":{"setNumber":1}}]');
  perform pg_temp.check(jsonb_array_length(r) = 3, 'T2 three results');
  perform pg_temp.check((select bool_and((e ->> 'applied')::boolean) from jsonb_array_elements(r) e), 'T2 all applied');
  perform pg_temp.check(not (r -> 0 ? 'payload'), 'T2 applied result has no payload');
  perform pg_temp.check((r -> 0 ->> 'version')::bigint < (r -> 1 ->> 'version')::bigint
                        and (r -> 1 ->> 'version')::bigint < (r -> 2 ->> 'version')::bigint, 'T2 versions increase');
  perform pg_temp.check(r -> 1 ->> 'at' = '2026-01-01T10:00:00.000Z', 'T2 at echoed with milliseconds');
  perform pg_temp.check(r -> 1 ->> 'updated_at' ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$', 'T2 updated_at in ISO ms format');
  perform pg_temp.check(r -> 1 ->> 'device_id' = 'dev1', 'T2 result has device_id');
  perform pg_temp.check((select count(*) from public.team_records) = 3, 'T2 MA reads 3 rows');
  -- updated_at is the clock time of the write (taken after the version), not the transaction start
  perform pg_temp.check((select bool_and(updated_at > now()) from public.team_records), 'T2 updated_at is clock time');
  perform pg_temp.check((select bool_and(updated_by = 'a0000000-0000-4000-8000-000000000001' and device_id = 'dev1')
                         from public.team_records), 'T2 updated_by and device_id');
  perform set_config('test.v_p1', r -> 1 ->> 'version', true);

  p := public.pull_changes('team-a', 0);
  perform pg_temp.check(jsonb_array_length(p -> 'rows') = 3, 'T2 pull returns 3 rows');
  perform pg_temp.check(p -> 'rows' -> 0 ->> 'kind' = 'team' and p -> 'rows' -> 2 ->> 'id' = 'm1/1', 'T2 pull ordered by version');
  perform pg_temp.check(p ->> 'server_now' ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$', 'T2 pull has server_now');
  perform pg_temp.check(p -> 'rows' -> 1 ->> 'at' = '2026-01-01T10:00:00.000Z', 'T2 pulled at in ISO ms format');
  perform pg_temp.check(jsonb_array_length(public.pull_changes('team-a', (r -> 1 ->> 'version')::bigint) -> 'rows') = 1, 'T2 pull after cursor');
  perform pg_temp.check(jsonb_array_length(public.pull_changes('team-a', 0, 1) -> 'rows') = 1, 'T2 pull limit');

  -- live hold used by T4 / T24
  perform pg_temp.check((public.hold_match('team-a', 'm1', 'dev1', 'Anna') ->> 'granted')::boolean, 'T2 MA holds m1');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T3 invite and join as player
-- ---------------------------------------------------------------------------------------------

do $$
declare
  i jsonb;
begin
  i := public.create_invite('team-a', 'player', 7);
  perform pg_temp.check(i ->> 'code' ~ '^[A-HJ-NP-Z2-9]{10}$' and i ->> 'role' = 'player', 'T3 invite code shape');
  perform pg_temp.check((i ->> 'expires_at')::timestamptz = now() + interval '7 days', 'T3 invite expiry');
  perform pg_temp.check(i -> 'max_uses' = 'null'::jsonb, 'T3 player codes are multi-use');
  perform set_config('test.code_player', i ->> 'code', true);
  perform set_config('test.invite_player', i ->> 'id', true);
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
declare
  c text := current_setting('test.code_player');
  j jsonb;
begin
  -- typed with a dash and in lower case: normalized by the server
  j := public.join_team(lower(substr(c, 1, 5)) || '-' || lower(substr(c, 6)), 'Pia');
  perform pg_temp.check(j = '{"team_id":"team-a","role":"player"}'::jsonb, 'T3 PA joins team-a as player');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T4 / T5 / T6 stranger
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from public.teams) = 0, 'T4 S reads no teams');
  perform pg_temp.check((select count(*) from public.team_members) = 0, 'T4 S reads no members');
  perform pg_temp.check((select count(*) from public.team_records) = 0, 'T4 S reads no records');
  perform pg_temp.check((select count(*) from public.invites) = 0, 'T4 S reads no invites');
  perform pg_temp.check((select count(*) from public.match_holds) = 0, 'T4 S reads no holds');
  perform pg_temp.check(public.pull_changes('team-a', 0) -> 'rows' = '[]'::jsonb, 'T4 S pulls nothing');

  perform pg_temp.expect_error('T5 S push', $q$select public.push_records('team-a', 'x', '[]')$q$, '42501');
  perform pg_temp.expect_error('T5 S create_invite', $q$select public.create_invite('team-a', 'player', 7)$q$, '42501');
  perform pg_temp.expect_error('T5 S delete_team', $q$select public.delete_team('team-a')$q$, '42501');
  perform pg_temp.expect_error('T5 S hold_match', $q$select public.hold_match('team-a', 'm1', 'x', 'S', true)$q$, '42501');
  perform pg_temp.expect_error('T5 S release_match', $q$select public.release_match('team-a', 'm1', 'dev1')$q$, '42501');
  perform pg_temp.expect_error('T5 S leave_team', $q$select public.leave_team('team-a')$q$, '42501');
  perform pg_temp.expect_error('T5 S set_member_role', $q$select public.set_member_role('team-a', 'a0000000-0000-4000-8000-000000000004', 'manager')$q$, '42501');
  perform pg_temp.expect_error('T5 S remove_member', $q$select public.remove_member('team-a', 'a0000000-0000-4000-8000-000000000001')$q$, '42501');
  perform pg_temp.expect_error('T5 S revoke_invite', format('select public.revoke_invite(%L)', current_setting('test.invite_player')), '42501');

  perform pg_temp.check(public.create_team('team-a', 'S') = 'taken', 'T6 S hijack: taken');
  perform pg_temp.check((select count(*) from public.team_members) = 0, 'T6 S still no membership');
  perform pg_temp.check((select count(*) from public.teams) = 0, 'T6 S still reads no teams');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T7 / T8 / T9 player
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from public.team_records) = 3, 'T7 PA reads 3 records');
  perform pg_temp.check((select count(*) from public.team_members) = 2, 'T7 PA reads 2 members');
  perform pg_temp.check((select count(*) from public.teams) = 1, 'T7 PA reads team-a');
  perform pg_temp.check((select count(*) from public.match_holds) = 1, 'T7 PA reads the hold');
  perform pg_temp.check((select count(*) from public.invites) = 0, 'T7 PA reads no invites');
  perform pg_temp.check(jsonb_array_length(public.pull_changes('team-a', 0) -> 'rows') = 3, 'T7 PA pulls 3 rows');

  perform pg_temp.expect_error('T8 PA push', $q$select public.push_records('team-a', 'x', '[{"kind":"player","id":"p9","at":"2026-01-01T10:00:00Z","payload":{}}]')$q$, '42501');
  perform pg_temp.expect_error('T8 PA create_invite', $q$select public.create_invite('team-a', 'manager', 7)$q$, '42501');
  perform pg_temp.expect_error('T8 PA promotes self', $q$select public.set_member_role('team-a', 'a0000000-0000-4000-8000-000000000003', 'manager')$q$, '42501');
  perform pg_temp.expect_error('T8 PA remove_member', $q$select public.remove_member('team-a', 'a0000000-0000-4000-8000-000000000001')$q$, '42501');
  perform pg_temp.expect_error('T8 PA hold_match', $q$select public.hold_match('team-a', 'm1', 'x', 'Pia', true)$q$, '42501');
  perform pg_temp.expect_error('T8 PA release_match', $q$select public.release_match('team-a', 'm1', 'dev1')$q$, '42501');
  perform pg_temp.expect_error('T8 PA delete_team', $q$select public.delete_team('team-a')$q$, '42501');
  perform pg_temp.expect_error('T8 PA revoke_invite', format('select public.revoke_invite(%L)', current_setting('test.invite_player')), '42501');
  perform pg_temp.check((select role from public.team_members where user_id = 'a0000000-0000-4000-8000-000000000003') = 'player', 'T8 PA is still player');

  perform pg_temp.expect_error('T9 insert record', $q$insert into public.team_records (team_id, kind, id, payload, client_updated_at) values ('team-a', 'player', 'px', '{}', now())$q$, '42501');
  perform pg_temp.expect_error('T9 update record', $q$update public.team_records set payload = '{}'$q$, '42501');
  perform pg_temp.expect_error('T9 delete record', $q$delete from public.team_records$q$, '42501');
  perform pg_temp.expect_error('T9 truncate records', $q$truncate public.team_records$q$, '42501');
  perform pg_temp.expect_error('T9 insert member', $q$insert into public.team_members (team_id, user_id, role) values ('team-a', 'a0000000-0000-4000-8000-000000000004', 'manager')$q$, '42501');
  perform pg_temp.expect_error('T9 update member', $q$update public.team_members set role = 'manager'$q$, '42501');
  perform pg_temp.expect_error('T9 delete member', $q$delete from public.team_members$q$, '42501');
  perform pg_temp.expect_error('T9 insert team', $q$insert into public.teams (id) values ('team-x')$q$, '42501');
  perform pg_temp.expect_error('T9 update team', $q$update public.teams set created_by = null$q$, '42501');
  perform pg_temp.expect_error('T9 delete team', $q$delete from public.teams$q$, '42501');
  perform pg_temp.expect_error('T9 insert invite', $q$insert into public.invites (team_id, code, role, expires_at) values ('team-a', 'ABCDEFGHJK', 'manager', now() + interval '1 day')$q$, '42501');
  perform pg_temp.expect_error('T9 update invite', $q$update public.invites set revoked_at = null$q$, '42501');
  perform pg_temp.expect_error('T9 insert hold', $q$insert into public.match_holds (team_id, match_id, device_id, held_until) values ('team-a', 'm9', 'x', now())$q$, '42501');
  perform pg_temp.expect_error('T9 delete hold', $q$delete from public.match_holds$q$, '42501');
  perform pg_temp.expect_error('T9 sequence', $q$select nextval('public.team_records_version_seq')$q$, '42501');
  perform pg_temp.expect_error('T9 read removals', $q$select * from private.team_removals$q$, '42501');
  perform pg_temp.expect_error('T9 delete removals', $q$delete from private.team_removals$q$, '42501');
  perform pg_temp.expect_error('T9 update team budget', $q$update public.teams set payload_bytes = 0$q$, '42501');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T10 manager of another team
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T10 MA push team-b', $q$select public.push_records('team-b', 'x', '[]')$q$, '42501');
  perform pg_temp.expect_error('T10 MA create_invite team-b', $q$select public.create_invite('team-b', 'player', 7)$q$, '42501');
  perform pg_temp.expect_error('T10 MA remove MB', $q$select public.remove_member('team-b', 'a0000000-0000-4000-8000-000000000002')$q$, '42501');
  perform pg_temp.expect_error('T10 MA set role team-b', $q$select public.set_member_role('team-b', 'a0000000-0000-4000-8000-000000000002', 'player')$q$, '42501');
  perform pg_temp.expect_error('T10 MA delete team-b', $q$select public.delete_team('team-b')$q$, '42501');
  perform pg_temp.expect_error('T10 MA hold team-b', $q$select public.hold_match('team-b', 'm1', 'dev1', 'Anna')$q$, '42501');
  perform pg_temp.check((select count(*) from public.teams where id = 'team-b') = 0, 'T10 MA reads no team-b');
  perform pg_temp.check((select count(*) from public.team_records where team_id = 'team-b') = 0, 'T10 MA reads no team-b records');
  perform pg_temp.check((select count(*) from public.team_members where team_id = 'team-b') = 0, 'T10 MA reads no team-b members');
  perform pg_temp.check(public.pull_changes('team-b', 0) -> 'rows' = '[]'::jsonb, 'T10 MA pulls nothing of team-b');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T11 / T12 / T13 storage
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T11 PA uploads', $q$insert into storage.objects (bucket_id, name) values ('team-photos', 'team-a/x')$q$, '42501');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  insert into storage.objects (bucket_id, name) values ('team-photos', 'team-a/x');
  perform pg_temp.expect_error('T12 MA uploads to team-b', $q$insert into storage.objects (bucket_id, name) values ('team-photos', 'team-b/y')$q$, '42501');
  perform pg_temp.expect_error('T12 MA uploads to a subfolder', $q$insert into storage.objects (bucket_id, name) values ('team-photos', 'team-a/sub/z')$q$, '42501');
  perform pg_temp.expect_error('T12 MA uploads to the root', $q$insert into storage.objects (bucket_id, name) values ('team-photos', 'z')$q$, '42501');
  perform pg_temp.check((select count(*) from storage.objects where bucket_id = 'team-photos') = 1, 'T12 MA sees its photo');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
declare
  n integer;
begin
  perform pg_temp.check((select array_agg(name) from storage.objects where bucket_id = 'team-photos') = array['team-a/x'], 'T13 PA sees team-a/x');
  -- The Storage API sets this flag for deletes; here it lets the policy decide.
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'team-photos';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'T13 PA can''t delete photos');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from storage.objects where bucket_id = 'team-photos') = 0, 'T13 S sees no photos');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
declare
  n integer;
begin
  perform pg_temp.check((select count(*) from storage.objects where bucket_id = 'team-photos') = 0, 'T13 MB sees no team-a photos');
  delete from storage.objects where bucket_id = 'team-photos';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'T13 MB can''t delete team-a photos');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  n integer;
begin
  delete from storage.objects where bucket_id = 'team-photos' and name = 'team-a/x';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 1, 'T13 MA deletes its team photo');
  perform set_config('storage.allow_delete_query', 'false', true);
  insert into storage.objects (bucket_id, name) values ('team-photos', 'team-a/x2');
end $$;

-- T13b at most 150 photos per team: fill team-a to 149 as postgres, MA adds the 150th.
reset role;
insert into storage.objects (bucket_id, name)
select 'team-photos', 'team-a/bulk-' || g from generate_series(1, 148) g
union all values ('team-photos', 'team-ab/other'), ('team-photos', 'team-a.b/other'); -- neighbours: not counted
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  insert into storage.objects (bucket_id, name) values ('team-photos', 'team-a/bulk-149');
  perform pg_temp.check(private.team_photo_count('team-a') = 150, 'T13b team-a has 150 photos');
  perform pg_temp.expect_error('T13b the 151st photo', $q$insert into storage.objects (bucket_id, name) values ('team-photos', 'team-a/bulk-150')$q$, '42501');
end $$;
reset role;
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'team-photos'
  and (name like 'team-a/bulk-%' or name in ('team-ab/other', 'team-a.b/other'));
select set_config('storage.allow_delete_query', 'false', true);
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;

-- ---------------------------------------------------------------------------------------------
-- T14 / T15 / T16 last write wins, clamp, tombstones (MA)
-- ---------------------------------------------------------------------------------------------

do $$
declare
  r jsonb;
  v_p1 bigint := current_setting('test.v_p1')::bigint;
begin
  -- older write: ignored, server row returned
  r := public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p1","at":"2026-01-01T09:00:00Z","payload":{"name":"Old"}}]') -> 0;
  perform pg_temp.check(not (r ->> 'applied')::boolean, 'T14 older write not applied');
  perform pg_temp.check(r -> 'payload' = '{"name":"Pia","number":7}'::jsonb, 'T14 server payload returned');
  perform pg_temp.check((r ->> 'version')::bigint = v_p1, 'T14 version unchanged');
  perform pg_temp.check((select payload ->> 'name' from public.team_records where kind = 'player' and id = 'p1') = 'Pia', 'T14 payload unchanged');
  -- the same write again (lost response): not applied, identical content
  r := public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p1","at":"2026-01-01T10:00:00Z","payload":{"name":"Pia","number":7}}]') -> 0;
  perform pg_temp.check(not (r ->> 'applied')::boolean and (r ->> 'version')::bigint = v_p1, 'T14 retry is idempotent');
  -- same time: the device id breaks the tie
  r := public.push_records('team-a', 'dev0', '[{"kind":"player","id":"p1","at":"2026-01-01T10:00:00Z","payload":{"name":"Zero"}}]') -> 0;
  perform pg_temp.check(not (r ->> 'applied')::boolean, 'T14 tie: lower device loses');
  r := public.push_records('team-a', 'dev2', '[{"kind":"player","id":"p1","at":"2026-01-01T10:00:00Z","payload":{"name":"Two"}}]') -> 0;
  perform pg_temp.check((r ->> 'applied')::boolean and (r ->> 'version')::bigint > v_p1, 'T14 tie: higher device wins');
  -- newer write wins
  r := public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p1","at":"2026-01-01T11:00:00Z","payload":{"name":"Pia","number":8}}]') -> 0;
  perform pg_temp.check((r ->> 'applied')::boolean, 'T14 newer write applied');
  perform pg_temp.check((select payload ->> 'number' from public.team_records where kind = 'player' and id = 'p1') = '8', 'T14 newer payload stored');

  -- T15 a clock a day ahead is clamped to now() + 1 minute
  r := public.push_records('team-a', 'dev1', jsonb_build_array(jsonb_build_object(
         'kind', 'player', 'id', 'p2', 'at', now() + interval '1 day', 'payload', '{}'::jsonb))) -> 0;
  perform pg_temp.check((r ->> 'applied')::boolean
                        and (r ->> 'at')::timestamptz = date_trunc('milliseconds', now()) + interval '1 minute', 'T15 clamped at returned');
  perform pg_temp.check((select client_updated_at from public.team_records where kind = 'player' and id = 'p2') <= now() + interval '1 minute', 'T15 clamped at stored');
  r := public.push_records('team-a', 'dev1', jsonb_build_array(jsonb_build_object(
         'kind', 'player', 'id', 'p2', 'at', now() + interval '2 days', 'payload', '{"x":1}'::jsonb))) -> 0;
  perform pg_temp.check(not (r ->> 'applied')::boolean, 'T15 clamped twice: same time, not applied');
  -- client times are kept to the millisecond, so `at` comes back exactly as JavaScript sends it
  r := public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p6","at":"2026-01-01T10:00:00.123456Z","payload":{}}]') -> 0;
  perform pg_temp.check(r ->> 'at' = '2026-01-01T10:00:00.123Z', 'T15 at truncated to milliseconds');
  r := public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p6","at":"2026-01-01T10:00:00.123Z","payload":{"x":1}}]') -> 0;
  perform pg_temp.check(not (r ->> 'applied')::boolean, 'T15 the same millisecond is the same time');

  -- T16 tombstone (a payload sent with it is dropped), visible in pull, then resurrected
  r := public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p1","at":"2026-01-01T12:00:00Z","deleted":true,"payload":{"x":1}}]') -> 0;
  perform pg_temp.check((r ->> 'applied')::boolean and (r ->> 'deleted')::boolean, 'T16 tombstone applied');
  perform pg_temp.check((select deleted and payload is null from public.team_records where kind = 'player' and id = 'p1'), 'T16 tombstone stored without payload');
  perform pg_temp.check((select e -> 'payload' = 'null'::jsonb and (e ->> 'deleted')::boolean
                         from jsonb_array_elements(public.pull_changes('team-a', 0) -> 'rows') e
                         where e ->> 'id' = 'p1'), 'T16 pull returns the tombstone');
  r := public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p1","at":"2026-01-01T13:00:00Z","payload":{"name":"Pia"}}]') -> 0;
  perform pg_temp.check((r ->> 'applied')::boolean and not (r ->> 'deleted')::boolean, 'T16 resurrected');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T17 checks and limits (MA)
-- ---------------------------------------------------------------------------------------------

do $$
declare
  r jsonb;
begin
  perform pg_temp.expect_error('T17 unknown kind', $q$select public.push_records('team-a', 'dev1', '[{"kind":"coach","id":"c1","at":"2026-01-01T10:00:00Z","payload":{}}]')$q$, '23514');
  perform pg_temp.expect_error('T17 200 kB payload', $q$select public.push_records('team-a', 'dev1', jsonb_build_array(jsonb_build_object('kind', 'player', 'id', 'big', 'at', '2026-01-01T10:00:00Z', 'payload', jsonb_build_object('x', repeat('x', 200000)))))$q$, '23514');
  perform pg_temp.expect_error('T17 team id mismatch', $q$select public.push_records('team-a', 'dev1', '[{"kind":"team","id":"other","at":"2026-01-01T10:00:00Z","payload":{}}]')$q$, '23514');
  perform pg_temp.expect_error('T17 starters id mismatch', $q$select public.push_records('team-a', 'dev1', '[{"kind":"starters","id":"s1","at":"2026-01-01T10:00:00Z","payload":{}}]')$q$, '23514');
  perform pg_temp.expect_error('T17 live record without payload', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p3","at":"2026-01-01T10:00:00Z"}]')$q$, '23514');
  perform pg_temp.expect_error('T17 array payload', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p3","at":"2026-01-01T10:00:00Z","payload":[1]}]')$q$, '23514');
  perform pg_temp.expect_error('T17 empty id', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"","at":"2026-01-01T10:00:00Z","payload":{}}]')$q$, '23514');
  perform pg_temp.expect_error('T17 long device id', format('select public.push_records(%L, %L, %L)', 'team-a', repeat('d', 65), '[{"kind":"player","id":"p3","at":"2026-01-01T10:00:00Z","payload":{}}]'), '23514');
  perform pg_temp.expect_error('T17 batch of 201', $q$select public.push_records('team-a', 'dev1', (select jsonb_agg(jsonb_build_object('kind', 'preset', 'id', 'q' || g, 'at', '2026-01-01T10:00:00Z', 'payload', '{}'::jsonb)) from generate_series(1, 201) g))$q$, '22023');
  perform pg_temp.expect_error('T17 batch over 1 MB', $q$select public.push_records('team-a', 'dev1', (select jsonb_agg(jsonb_build_object('kind', 'preset', 'id', 'q' || g, 'at', '2026-01-01T10:00:00Z', 'payload', jsonb_build_object('x', repeat('x', 99000)))) from generate_series(1, 11) g))$q$, '22023');
  perform pg_temp.expect_error('T17 not an array', $q$select public.push_records('team-a', 'dev1', '{}')$q$, '22023');
  perform pg_temp.expect_error('T17 null batch', $q$select public.push_records('team-a', 'dev1', null)$q$, '22023');
  perform pg_temp.expect_error('T17 item not an object', $q$select public.push_records('team-a', 'dev1', '[1]')$q$, '22023');
  perform pg_temp.expect_error('T17 missing at', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p3","payload":{}}]')$q$, '22023');
  perform pg_temp.expect_error('T17 bad at', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p3","at":"soon","payload":{}}]')$q$, '22023');
  perform pg_temp.expect_error('T17 bad deleted', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p3","at":"2026-01-01T10:00:00Z","deleted":"yes"}]')$q$, '22023');
  perform pg_temp.expect_error('T17 -infinity at', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p3","at":"-infinity","payload":{}}]')$q$, '22023');
  perform pg_temp.expect_error('T17 infinity at', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p3","at":"infinity","payload":{}}]')$q$, '22023');
  perform pg_temp.expect_error('T17 70 kB payload (cap 64 kB)', $q$select public.push_records('team-a', 'dev1', jsonb_build_array(jsonb_build_object('kind', 'player', 'id', 'big', 'at', '2026-01-01T10:00:00Z', 'payload', jsonb_build_object('x', repeat('x', 70000)))))$q$, '23514');
  r := public.push_records('team-a', 'dev1', jsonb_build_array(jsonb_build_object('kind', 'player', 'id', 'p60', 'at', '2026-01-01T10:00:00Z', 'payload', jsonb_build_object('x', repeat('x', 60000)))));
  perform pg_temp.check((r -> 0 ->> 'applied')::boolean, 'T17 60 kB payload accepted');
  perform pg_temp.check((select count(*) from public.team_records where id in ('c1', 'big', 'other', 's1', 'p3', '')) = 0, 'T17 nothing written by rejected batches');

  -- a batch of exactly 200 is fine
  r := public.push_records('team-a', 'dev1', (select jsonb_agg(jsonb_build_object('kind', 'preset', 'id', 'q' || g, 'at', '2026-01-01T10:00:00Z', 'payload', '{}'::jsonb)) from generate_series(1, 200) g));
  perform pg_temp.check(jsonb_array_length(r) = 200, 'T17 batch of 200 accepted');

  -- create_invite arguments
  perform pg_temp.expect_error('T17 invite 0 days', $q$select public.create_invite('team-a', 'player', 0)$q$, '22023');
  perform pg_temp.expect_error('T17 invite 31 days', $q$select public.create_invite('team-a', 'player', 31)$q$, '22023');
  perform pg_temp.expect_error('T17 invite bad role', $q$select public.create_invite('team-a', 'coach', 7)$q$, '22023');
  perform pg_temp.expect_error('T17 manager invite 8 days', $q$select public.create_invite('team-a', 'manager', 8)$q$, '22023');
  perform pg_temp.expect_error('T17 bad member role', $q$select public.set_member_role('team-a', 'a0000000-0000-4000-8000-000000000003', 'coach')$q$, '22023');
end $$;

-- Row overhead: a new record costs its payload plus 512 bytes; an update only the size change.
do $$
declare
  v_before bigint := (select payload_bytes from public.teams where id = 'team-a');
begin
  perform public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p7","at":"2026-01-01T10:00:00Z","payload":{"a":1}}]');
  perform pg_temp.check((select payload_bytes from public.teams where id = 'team-a') = v_before + octet_length('{"a": 1}') + 512,
                        'T17 a new record costs payload + 512 bytes');
  perform public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p7","at":"2026-01-01T10:00:01Z","payload":{"a":12}}]');
  perform pg_temp.check((select payload_bytes from public.teams where id = 'team-a') = v_before + octet_length('{"a": 12}') + 512,
                        'T17 an update costs only the size change');
  perform public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p7","at":"2026-01-01T10:00:02Z","deleted":true}]');
  perform pg_temp.check((select payload_bytes from public.teams where id = 'team-a') = v_before + 512,
                        'T17 a tombstone keeps the row overhead');
end $$;

-- Team full by bytes (VL007): teams.payload_bytes follows every write; growing past 20 MB fails.
reset role;
do $$
begin
  perform pg_temp.check((select payload_bytes from public.teams where id = 'team-a')
                        = (select sum(octet_length(payload::text)) + 512 * count(*) from public.team_records where team_id = 'team-a'),
                        'T17 payload_bytes is the sum of the payloads');
end $$;
update public.teams set payload_bytes = 20 * 1024 * 1024 - 10 where id = 'team-a';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T17 team full (bytes)', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p5","at":"2026-01-01T10:00:00Z","payload":{"name":"too much"}}]')$q$, 'VL007');
  perform pg_temp.check((public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p60","at":"2026-01-01T10:00:01Z","deleted":true}]') -> 0 ->> 'applied')::boolean,
                        'T17 a shrinking write passes the budget');
end $$;
reset role;
update public.teams
set payload_bytes = (select coalesce(sum(octet_length(payload::text)), 0) + 512 * count(*) from public.team_records where team_id = 'team-a')
where id = 'team-a';

-- Team full by count (VL007): fill team-a to 20 000 records as postgres.
insert into public.team_records (team_id, kind, id, payload, client_updated_at)
select 'team-a', 'opponent', 'fill' || g, '{}', now()
from generate_series(1, 20000 - (select count(*) from public.team_records where team_id = 'team-a')) g;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from public.team_records) = 20000, 'T17 team-a is full');
  perform pg_temp.expect_error('T17 team full', $q$select public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p4","at":"2026-01-01T10:00:00Z","payload":{}}]')$q$, 'VL007');
  perform pg_temp.check((public.push_records('team-a', 'dev1', '[{"kind":"player","id":"p2","at":"2026-01-01T10:00:00Z","deleted":true}]') -> 0) ? 'applied', 'T17 a full team still accepts updates');
end $$;
reset role;
-- Records are only ever removed with their team; here the filler goes and the budget is re-synced.
delete from public.team_records where team_id = 'team-a' and id like 'fill%';
update public.teams
set payload_bytes = (select coalesce(sum(octet_length(payload::text)), 0) + 512 * count(*) from public.team_records where team_id = 'team-a')
where id = 'team-a';

-- Too many teams (VL006): MB has created 10 teams (team-b + 9 more as postgres).
insert into public.teams (id, created_by)
select 'fill-' || g, 'a0000000-0000-4000-8000-000000000002' from generate_series(1, 9) g;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T17 too many teams', $q$select public.create_team('team-z', 'Ben')$q$, 'VL006');
  perform pg_temp.check(public.create_team('team-b', 'Ben') = 'member', 'T17 re-uploading an existing team is not limited');
end $$;
reset role;
delete from public.teams where id like 'fill-%';

-- ---------------------------------------------------------------------------------------------
-- T18 last manager (MA, while PA is a member)
-- ---------------------------------------------------------------------------------------------

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T18 MA demotes self', $q$select public.set_member_role('team-a', 'a0000000-0000-4000-8000-000000000001', 'player')$q$, 'VL001');
  perform pg_temp.expect_error('T18 MA leaves', $q$select public.leave_team('team-a')$q$, 'VL001');
  perform pg_temp.expect_error('T18 MA removes self', $q$select public.remove_member('team-a', 'a0000000-0000-4000-8000-000000000001')$q$, 'VL001');
  perform pg_temp.check((select role from public.team_members where user_id = 'a0000000-0000-4000-8000-000000000001') = 'manager', 'T18 MA is still manager');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T21 expired, revoked and unknown invites; invite limit
-- ---------------------------------------------------------------------------------------------

do $$
declare
  i jsonb;
begin
  i := public.create_invite('team-a', 'player', 7);
  perform set_config('test.code_expired', i ->> 'code', true);
  perform set_config('test.invite_expired', i ->> 'id', true);
  i := public.create_invite('team-a', 'player', 30);
  perform set_config('test.code_revoked', i ->> 'code', true);
  perform public.revoke_invite((i ->> 'id')::uuid);
  perform public.revoke_invite((i ->> 'id')::uuid); -- idempotent
  perform pg_temp.check((select revoked_at is not null from public.invites where id = (i ->> 'id')::uuid), 'T21 invite revoked');
end $$;

reset role;
update public.invites set created_at = now() - interval '2 days', expires_at = now() - interval '1 second'
where id = current_setting('test.invite_expired')::uuid;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T21 expired code', format('select public.join_team(%L, %L)', current_setting('test.code_expired'), 'S'), 'VL002');
  perform pg_temp.expect_error('T21 revoked code', format('select public.join_team(%L, %L)', current_setting('test.code_revoked'), 'S'), 'VL002');
  perform pg_temp.expect_error('T21 unknown code', $q$select public.join_team('ABCDE-FGHJK', 'S')$q$, 'VL002');
  perform pg_temp.expect_error('T21 empty code', $q$select public.join_team(null, 'S')$q$, 'VL002');
  perform pg_temp.check((select count(*) from public.team_members) = 0, 'T21 S joined nothing');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  -- one active invite (T3) so far: 19 more reach the limit of 20
  for n in 1..19 loop
    perform public.create_invite('team-a', 'player', 1);
  end loop;
  perform pg_temp.expect_error('T21 21st active invite', $q$select public.create_invite('team-a', 'player', 1)$q$, 'VL007');
end $$;
reset role;
delete from public.invites
where team_id = 'team-a' and expires_at = now() + interval '1 day';

-- ---------------------------------------------------------------------------------------------
-- T22 codes never downgrade
-- ---------------------------------------------------------------------------------------------

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform set_config('test.code_manager', public.create_invite('team-a', 'manager', 7) ->> 'code', true);
  perform pg_temp.check(public.join_team(current_setting('test.code_player'), '') = '{"team_id":"team-a","role":"manager"}'::jsonb, 'T22 player code keeps MA manager');
  perform pg_temp.check((select display_name from public.team_members where user_id = 'a0000000-0000-4000-8000-000000000001') = 'Anna', 'T22 empty name keeps the old one');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.join_team(current_setting('test.code_player'), 'Ben') ->> 'role' = 'player', 'T22 MB joins team-a as player');
  perform pg_temp.check(public.join_team(current_setting('test.code_manager'), 'Ben') ->> 'role' = 'manager', 'T22 manager code upgrades MB');
  perform pg_temp.check(public.join_team(current_setting('test.code_player'), 'Ben') ->> 'role' = 'manager', 'T22 player code doesn''t downgrade MB');
  perform pg_temp.check((select uses from public.invites where code = current_setting('test.code_player')) = 4, 'T22 uses counted');
  perform pg_temp.check((select max_uses = 1 and expires_at <= created_at + interval '7 days' from public.invites
                         where code = current_setting('test.code_manager')), 'T22 manager codes: single use, at most 7 days');
end $$;

-- T22b a manager code works once: the next person gets VL002
reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T22b manager code used up', format('select public.join_team(%L, %L)', current_setting('test.code_manager'), 'S'), 'VL002');
  perform pg_temp.check((select count(*) from public.team_members) = 0, 'T22b S joined nothing');
end $$;
reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;

-- ---------------------------------------------------------------------------------------------
-- T24 live holds (MA holds m1 on dev1 since T2; MB is now a second manager)
-- ---------------------------------------------------------------------------------------------

do $$
declare
  h jsonb;
begin
  h := public.hold_match('team-a', 'm1', 'dev2', 'Ben');
  perform pg_temp.check(not (h ->> 'granted')::boolean and h ->> 'holder_name' = 'Anna', 'T24 MB is refused while MA holds');
  h := public.hold_match('team-a', 'm1', 'dev2', 'Ben', true);
  perform pg_temp.check((h ->> 'granted')::boolean and h ->> 'holder_name' = 'Ben', 'T24 MB takes over');
  perform pg_temp.check((h ->> 'held_until')::timestamptz = now() + interval '15 minutes', 'T24 15 minute lease');
  perform pg_temp.check((public.hold_match('team-a', 'm1', 'dev2', 'Ben') ->> 'granted')::boolean, 'T24 MB refreshes its hold');
  perform pg_temp.check((public.hold_match('team-a', 'm2', 'dev2', 'Ben') ->> 'granted')::boolean, 'T24 MB holds m2');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  h jsonb;
begin
  h := public.hold_match('team-a', 'm1', 'dev1', 'Anna');
  perform pg_temp.check(not (h ->> 'granted')::boolean and h ->> 'holder_name' = 'Ben', 'T24 MA is refused after the take-over');
  perform public.release_match('team-a', 'm1', 'dev1');
  perform pg_temp.check((select device_id from public.match_holds where match_id = 'm1') = 'dev2', 'T24 release of another device''s hold is a no-op');
end $$;

reset role;
update public.match_holds set held_until = now() - interval '1 second' where match_id = 'm1';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.check((public.hold_match('team-a', 'm1', 'dev1', 'Anna') ->> 'granted')::boolean, 'T24 an expired hold can be claimed');
  perform public.release_match('team-a', 'm1', 'dev1');
  perform pg_temp.check((select count(*) from public.match_holds where match_id = 'm1') = 0, 'T24 MA releases its hold');
  perform pg_temp.check((public.hold_match('team-a', 'm3', 'dev1', 'Anna') ->> 'granted')::boolean, 'T24 MA holds m3');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from public.match_holds) = 2, 'T24 PA sees the holds');
end $$;

-- T24b at most 50 active holds per team; holds expired more than a day ago are pruned.
reset role;
insert into public.match_holds (team_id, match_id, device_id, held_until)
select 'team-a', 'h' || g, 'dev9', now() + interval '10 minutes' from generate_series(1, 48) g;
insert into public.match_holds (team_id, match_id, device_id, held_until)
values ('team-a', 'old', 'dev9', now() - interval '2 days');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T24b 51st active hold', $q$select public.hold_match('team-a', 'm4', 'dev1', 'Anna')$q$, 'VL007');
  perform pg_temp.check((public.hold_match('team-a', 'm3', 'dev1', 'Anna') ->> 'granted')::boolean, 'T24b refreshing a held match still works');
  perform pg_temp.check(not exists (select 1 from public.match_holds where match_id = 'old'), 'T24b long-expired hold pruned');
end $$;
reset role;
delete from public.match_holds where match_id like 'h%';

-- ---------------------------------------------------------------------------------------------
-- T19 promote, then leave: the leaver loses access
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform public.set_member_role('team-a', 'a0000000-0000-4000-8000-000000000003', 'manager');
  perform public.leave_team('team-a');
  perform pg_temp.check((select count(*) from public.teams) = 0, 'T19 MA reads no teams');
  perform pg_temp.check((select count(*) from public.team_members) = 0, 'T19 MA reads no members');
  perform pg_temp.check((select count(*) from public.team_records) = 0, 'T19 MA reads no records');
  perform pg_temp.check((select count(*) from public.invites) = 0, 'T19 MA reads no invites');
  perform pg_temp.check((select count(*) from public.match_holds) = 0, 'T19 MA reads no holds');
  perform pg_temp.check((select count(*) from storage.objects where bucket_id = 'team-photos') = 0, 'T19 MA sees no photos');
  perform pg_temp.check(public.pull_changes('team-a', 0) -> 'rows' = '[]'::jsonb, 'T19 MA pulls nothing');
  perform pg_temp.expect_error('T19 MA can''t push any more', $q$select public.push_records('team-a', 'dev1', '[]')$q$, '42501');
end $$;

reset role;
do $$
begin
  perform pg_temp.check((select count(*) from public.match_holds where match_id = 'm3') = 0, 'T19 the leaver''s hold is gone');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T20 removed member loses access (PA, now manager, removes MB)
-- ---------------------------------------------------------------------------------------------

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform public.remove_member('team-a', 'a0000000-0000-4000-8000-000000000002');
  perform public.remove_member('team-a', 'a0000000-0000-4000-8000-000000000002'); -- no-op
  perform pg_temp.expect_error('T20 PA demotes self (last manager)', $q$select public.set_member_role('team-a', 'a0000000-0000-4000-8000-000000000003', 'player')$q$, 'VL001');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select array_agg(id) from public.teams) = array['team-b'], 'T20 MB reads only team-b');
  perform pg_temp.check((select count(*) from public.team_records where team_id = 'team-a') = 0, 'T20 MB reads no team-a records');
  perform pg_temp.check((select count(*) from public.team_members where team_id = 'team-a') = 0, 'T20 MB reads no team-a members');
  perform pg_temp.check((select count(*) from public.match_holds) = 0, 'T20 MB reads no holds');
  perform pg_temp.check((select count(*) from storage.objects where bucket_id = 'team-photos') = 0, 'T20 MB sees no team-a photos');
  perform pg_temp.check(public.pull_changes('team-a', 0) -> 'rows' = '[]'::jsonb, 'T20 MB pulls nothing of team-a');
end $$;

reset role;
do $$
begin
  perform pg_temp.check((select count(*) from public.match_holds where match_id = 'm2') = 0, 'T20 the removed member''s hold is gone');
  perform pg_temp.check(exists (select 1 from private.team_removals
                                where team_id = 'team-a' and user_id = 'a0000000-0000-4000-8000-000000000002'), 'T20 removal recorded');
end $$;

-- T20b a removed member can't come back with a code created before the removal; a new code works.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T20b MB rejoins with the old code', format('select public.join_team(%L, %L)', current_setting('test.code_player'), 'Ben'), 'VL002');
end $$;
reset role;
-- make the timeline explicit (inside one transaction now() doesn't move): code, then removal
update public.invites set created_at = now() - interval '2 minutes' where code = current_setting('test.code_player');
update private.team_removals set removed_at = now() - interval '1 minute' where team_id = 'team-a';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform set_config('test.code_reinvite', public.create_invite('team-a', 'player', 7) ->> 'code', true);
end $$;
reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T20b old code still refused', format('select public.join_team(%L, %L)', current_setting('test.code_player'), 'Ben'), 'VL002');
  perform pg_temp.check(public.join_team(current_setting('test.code_reinvite'), 'Ben') ->> 'role' = 'player', 'T20b a new code re-invites MB');
end $$;
reset role;
do $$
begin
  perform pg_temp.check(not exists (select 1 from private.team_removals where team_id = 'team-a'), 'T20b a join clears the removal');
end $$;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform public.remove_member('team-a', 'a0000000-0000-4000-8000-000000000002');
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------
-- T23 the only member can't leave
-- ---------------------------------------------------------------------------------------------

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T23 MB leaves team-b', $q$select public.leave_team('team-b')$q$, 'VL004');
  perform pg_temp.expect_error('T23 MB removes self', $q$select public.remove_member('team-b', 'a0000000-0000-4000-8000-000000000002')$q$, 'VL004');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T23 PA leaves team-a', $q$select public.leave_team('team-a')$q$, 'VL004');
  -- setup for T26: S joins team-a as player; PA also has a team of its own
  perform set_config('test.code_s', public.create_invite('team-a', 'player', 7) ->> 'code', true);
  perform pg_temp.check(public.create_team('team-c', 'Pia') = 'created', 'T26 PA creates team-c');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.join_team(current_setting('test.code_s'), 'Sam') ->> 'role' = 'player', 'T26 S joins team-a');
  perform pg_temp.check(public.account_deletion_check() = '{"delete_teams":[],"blocked_teams":[]}'::jsonb, 'T26 S: nothing blocked, nothing deleted');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T25 / T26 account deletion
-- ---------------------------------------------------------------------------------------------

reset role; select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
do $$
begin
  perform pg_temp.expect_error('T25 anon account_deletion_check', $q$select public.account_deletion_check()$q$, '42501');
  perform pg_temp.expect_error('T25 anon delete_my_account', $q$select public.delete_my_account()$q$, '42501');
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
declare
  v_state text;
  v_detail text;
begin
  perform pg_temp.check(public.account_deletion_check() = '{"delete_teams":["team-c"],"blocked_teams":["team-a"]}'::jsonb, 'T26 PA: team-a blocked, team-c deleted');
  begin
    perform public.delete_my_account();
    raise exception 'FAIL T25 blocked delete_my_account succeeded';
  exception when sqlstate 'VL001' then
    get stacked diagnostics v_detail = pg_exception_detail;
    perform pg_temp.check(v_detail = 'team-a', 'T25 VL001 names the blocked team');
  end;
end $$;

reset role; select pg_temp.as_user('a0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.account_deletion_check() = '{"delete_teams":["team-b"],"blocked_teams":[]}'::jsonb, 'T26 MB: team-b deleted');
  perform pg_temp.check(public.delete_my_account() = array['team-b'], 'T25 MB deletes the account');
end $$;

reset role;
do $$
begin
  perform pg_temp.check(not exists (select 1 from auth.users where id = 'a0000000-0000-4000-8000-000000000002'), 'T25 MB user gone');
  perform pg_temp.check(not exists (select 1 from public.team_members where user_id = 'a0000000-0000-4000-8000-000000000002'), 'T25 MB memberships gone');
  perform pg_temp.check(not exists (select 1 from public.teams where id = 'team-b'), 'T25 sole team gone');
  perform pg_temp.check(not exists (select 1 from public.team_records where team_id = 'team-b'), 'T25 sole team records gone');
  perform pg_temp.check(coalesce(current_setting('app.bypass_member_guard', true), 'off') = 'off', 'T25 guard bypass reset');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T27 delete for everyone (PA is the last manager, S a player: the guard must not fire)
-- ---------------------------------------------------------------------------------------------

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from public.invites where team_id = 'team-a') > 0, 'T27 team-a has invites');
  perform public.hold_match('team-a', 'm1', 'dev3', 'Pia');
  -- photos first: while team-a/x2 is stored, delete_team refuses (VL008)
  perform pg_temp.expect_error('T27 photos remain', $q$select public.delete_team('team-a')$q$, 'VL008');
  perform set_config('storage.allow_delete_query', 'true', true); -- what the Storage API does
  delete from storage.objects where bucket_id = 'team-photos' and name like 'team-a/%';
  perform set_config('storage.allow_delete_query', 'false', true);
  perform public.delete_team('team-a');
end $$;

reset role;
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.teams where id = 'team-a'), 'T27 team gone');
  perform pg_temp.check(not exists (select 1 from public.team_members where team_id = 'team-a'), 'T27 members gone');
  perform pg_temp.check(not exists (select 1 from public.team_records where team_id = 'team-a'), 'T27 records gone');
  perform pg_temp.check(not exists (select 1 from public.invites where team_id = 'team-a'), 'T27 invites gone');
  perform pg_temp.check(not exists (select 1 from public.match_holds where team_id = 'team-a'), 'T27 holds gone');
  perform pg_temp.check(coalesce(current_setting('app.bypass_member_guard', true), 'off') = 'off', 'T27 guard bypass reset');
end $$;

-- T27b photos left behind by an earlier team with the same id: the id counts as taken.
insert into storage.objects (bucket_id, name) values ('team-photos', 'team-old/leftover');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.create_team('team-old', 'Sam') = 'taken', 'T27b leftover photos: taken');
  perform pg_temp.check((select count(*) from storage.objects where bucket_id = 'team-photos') = 0, 'T27b S can''t see the leftover photo');
end $$;
reset role;
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'team-photos' and name = 'team-old/leftover';
select set_config('storage.allow_delete_query', 'false', true);

-- PA now deletes the account: team-c (sole member) goes with it, once its photos are gone.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
declare
  v_detail text;
begin
  insert into storage.objects (bucket_id, name) values ('team-photos', 'team-c/p');
  begin
    perform public.delete_my_account();
    raise exception 'FAIL T25 delete_my_account with photos succeeded';
  exception when sqlstate 'VL008' then
    get stacked diagnostics v_detail = pg_exception_detail;
    perform pg_temp.check(v_detail = 'team-c', 'T25 VL008 names the team with photos');
  end;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'team-photos' and name = 'team-c/p';
  perform set_config('storage.allow_delete_query', 'false', true);
  perform pg_temp.check(public.delete_my_account() = array['team-c'], 'T25 PA deletes the account');
end $$;

reset role;
do $$
begin
  perform pg_temp.check(not exists (select 1 from auth.users where id = 'a0000000-0000-4000-8000-000000000003'), 'T25 PA user gone');
  perform pg_temp.check(not exists (select 1 from public.teams where id = 'team-c'), 'T25 PA sole team gone');
end $$;

-- Safety net: deleting a user outside delete_my_account (dashboard) drops their sole teams.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.create_team('team-s', 'Sam') = 'created', 'T27 S creates team-s');
end $$;
reset role;
delete from auth.users where id = 'a0000000-0000-4000-8000-000000000004';
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.teams where id = 'team-s'), 'T27 empty team dropped');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T31 / T32 / T33 invite codes don't outlive the access of the people who know them
-- (docs/AUDIT_V10.md H1, migration 20261126120000). Own users and team: DA (manager),
-- DB (second manager), DB2 (DB's second account), DP (player).
-- ---------------------------------------------------------------------------------------------

reset role;
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
from (values ('d0000000-0000-4000-8000-000000000001'::uuid, 'rls-da@example.test'),
             ('d0000000-0000-4000-8000-000000000002'::uuid, 'rls-db@example.test'),
             ('d0000000-0000-4000-8000-000000000003'::uuid, 'rls-db2@example.test'),
             ('d0000000-0000-4000-8000-000000000004'::uuid, 'rls-dp@example.test')) u (id, email);

select pg_temp.as_user('d0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.create_team('team-d', 'Dora') = 'created', 'T31 DA creates team-d');
  perform set_config('test.d_manager', public.create_invite('team-d', 'manager', 7) ->> 'code', true);
  perform set_config('test.d_player', public.create_invite('team-d', 'player', 30) ->> 'code', true);
end $$;

reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.join_team(current_setting('test.d_player'), 'Pit') ->> 'role' = 'player', 'T31 DP joins as player');
end $$;

-- DB joins as manager and, as a manager may, creates a spare manager code and keeps it.
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.join_team(current_setting('test.d_manager'), 'Bea') ->> 'role' = 'manager', 'T31 DB joins as manager');
  perform set_config('test.d_spare', public.create_invite('team-d', 'manager', 7) ->> 'code', true);
  perform pg_temp.check((select count(*) from public.invites where team_id = 'team-d' and role = 'manager' and revoked_at is null and uses = 0) = 1, 'T31 one unused manager code is open');
end $$;

-- T31 DA makes DB a player: the open manager codes are revoked, the player code stays.
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform public.set_member_role('team-d', 'd0000000-0000-4000-8000-000000000002', 'player');
  perform pg_temp.check((select count(*) from public.invites where team_id = 'team-d' and role = 'manager' and revoked_at is null) = 0, 'T31 a demotion revokes the open manager codes');
  perform pg_temp.check((select revoked_at is null from public.invites where code = current_setting('test.d_player')), 'T31 a demotion keeps the player code');
end $$;

reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T31 demoted DB uses the spare manager code', format('select public.join_team(%L, %L)', current_setting('test.d_spare'), 'Bea'), 'VL002');
  perform pg_temp.check((select role from public.team_members where team_id = 'team-d' and user_id = 'd0000000-0000-4000-8000-000000000002') = 'player', 'T31 DB is still a player');
  perform pg_temp.expect_error('T31 demoted DB creates a code', $q$select public.create_invite('team-d', 'manager', 7)$q$, '42501');
  perform pg_temp.expect_error('T31 demoted DB changes a role', $q$select public.set_member_role('team-d', 'd0000000-0000-4000-8000-000000000004', 'manager')$q$, '42501');
  perform pg_temp.check(public.join_team(current_setting('test.d_player'), 'Bea') ->> 'role' = 'player', 'T31 the player code still works (DB stays a player)');
end $$;

-- T32 DA removes DB: every open code of the team is revoked, so DB's second account can't use
-- the player code DB knows; a code created afterwards works.
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform set_config('test.d_manager2', public.create_invite('team-d', 'manager', 7) ->> 'code', true);
  perform public.remove_member('team-d', 'd0000000-0000-4000-8000-000000000002');
  perform pg_temp.check((select count(*) from public.invites where team_id = 'team-d' and revoked_at is null) = 0, 'T32 a removal revokes every open code');
end $$;

reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('T32 second account, old player code', format('select public.join_team(%L, %L)', current_setting('test.d_player'), 'Bea 2'), 'VL002');
  perform pg_temp.expect_error('T32 second account, old manager code', format('select public.join_team(%L, %L)', current_setting('test.d_manager2'), 'Bea 2'), 'VL002');
  perform pg_temp.check((select count(*) from public.team_members) = 0, 'T32 the second account joined nothing');
  perform pg_temp.check((select count(*) from public.team_records where team_id = 'team-d') = 0
                        and public.pull_changes('team-d', 0) -> 'rows' = '[]'::jsonb, 'T32 the second account reads nothing');
end $$;

reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform set_config('test.d_new', public.create_invite('team-d', 'player', 7) ->> 'code', true);
end $$;
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.join_team(current_setting('test.d_new'), 'Bea 2') ->> 'role' = 'player', 'T32 a code created after the removal works');
end $$;

-- T33 leaving: a player's leave revokes nothing; a manager's leave revokes the manager codes.
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform set_config('test.d_manager3', public.create_invite('team-d', 'manager', 7) ->> 'code', true);
end $$;
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform public.leave_team('team-d');
end $$;
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from public.invites where team_id = 'team-d' and revoked_at is null) = 2, 'T33 a player leaving revokes nothing');
  perform public.set_member_role('team-d', 'd0000000-0000-4000-8000-000000000004', 'manager');
  perform pg_temp.check((select revoked_at is null from public.invites where code = current_setting('test.d_manager3')), 'T33 a promotion revokes nothing');
end $$;
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform public.leave_team('team-d');
end $$;
reset role; select pg_temp.as_user('d0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select revoked_at is not null from public.invites where code = current_setting('test.d_manager3')), 'T33 a manager leaving revokes the open manager codes');
  perform pg_temp.check((select revoked_at is null from public.invites where code = current_setting('test.d_new')), 'T33 a manager leaving keeps the player codes');
  perform public.delete_team('team-d');
  perform pg_temp.check((select count(*) from public.teams) = 0, 'T33 delete_team still works with the invite trigger');
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------
-- T28 / T29 anon
-- ---------------------------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
do $$
begin
  perform pg_temp.check((select count(*) from public.keepalive) = 1, 'T28 anon reads keepalive');
  perform pg_temp.expect_error('T28 anon writes keepalive', $q$insert into public.keepalive (id) values (1)$q$, '42501');
  perform pg_temp.expect_error('T28 anon updates keepalive', $q$update public.keepalive set note = 'x'$q$, '42501');
  perform pg_temp.expect_error('T28 anon reads teams', $q$select * from public.teams$q$, '42501');
  perform pg_temp.expect_error('T28 anon reads members', $q$select * from public.team_members$q$, '42501');
  perform pg_temp.expect_error('T28 anon reads records', $q$select * from public.team_records$q$, '42501');
  perform pg_temp.expect_error('T28 anon reads invites', $q$select * from public.invites$q$, '42501');
  perform pg_temp.expect_error('T28 anon reads holds', $q$select * from public.match_holds$q$, '42501');
  perform pg_temp.check((select count(*) from storage.objects where bucket_id = 'team-photos') = 0, 'T28 anon sees no photos');

  perform pg_temp.expect_error('T29 anon join_team', $q$select public.join_team('ABCDEFGHJK', 'x')$q$, '42501');
  perform pg_temp.expect_error('T29 anon push_records', $q$select public.push_records('team-a', 'x', '[]')$q$, '42501');
  perform pg_temp.expect_error('T29 anon pull_changes', $q$select public.pull_changes('team-a', 0)$q$, '42501');
  perform pg_temp.expect_error('T29 anon create_team', $q$select public.create_team('team-q', 'x')$q$, '42501');
  perform pg_temp.expect_error('T29 anon create_invite', $q$select public.create_invite('team-a', 'player', 7)$q$, '42501');
  perform pg_temp.expect_error('T29 anon hold_match', $q$select public.hold_match('team-a', 'm1', 'x', 'x')$q$, '42501');
end $$;

-- ---------------------------------------------------------------------------------------------
-- T30 catalogue checks (what the advisors look at)
-- ---------------------------------------------------------------------------------------------

reset role;
do $$
declare
  v_fns text[] := array[
    'public.create_team(text,text)', 'public.leave_team(text)',
    'public.set_member_role(text,uuid,text)', 'public.remove_member(text,uuid)',
    'public.delete_team(text)', 'public.push_records(text,text,jsonb)',
    'public.pull_changes(text,bigint,integer)', 'public.create_invite(text,text,integer)',
    'public.revoke_invite(uuid)', 'public.join_team(text,text)',
    'public.hold_match(text,text,text,text,boolean)', 'public.release_match(text,text,text)',
    'public.account_deletion_check()', 'public.delete_my_account()'];
  v_tables text[] := array['public.teams', 'public.team_members', 'public.team_records',
                           'public.invites', 'public.match_holds', 'public.keepalive'];
  v_bad text;
begin
  select string_agg(f, ', ') into v_bad from unnest(v_fns) f
  where has_function_privilege('anon', f, 'execute') or not has_function_privilege('authenticated', f, 'execute');
  perform pg_temp.check(v_bad is null, 'T30 RPC execute grants: ' || coalesce(v_bad, ''));

  select string_agg(p.oid::regprocedure::text, ', ') into v_bad from pg_proc p
  where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
    and p.proname <> 'rls_auto_enable'
    and not coalesce(p.proconfig @> array['search_path=""'], false);
  perform pg_temp.check(v_bad is null, 'T30 search_path set: ' || coalesce(v_bad, ''));

  select string_agg(p.oid::regprocedure::text, ', ') into v_bad from pg_proc p
  where p.pronamespace = 'private'::regnamespace and has_function_privilege('anon', p.oid, 'execute');
  perform pg_temp.check(v_bad is null, 'T30 private functions closed to anon: ' || coalesce(v_bad, ''));

  select string_agg(t, ', ') into v_bad from unnest(v_tables) t
  where not (select relrowsecurity from pg_class where oid = t::regclass);
  perform pg_temp.check(v_bad is null, 'T30 RLS enabled: ' || coalesce(v_bad, ''));

  select string_agg(t, ', ') into v_bad from unnest(v_tables) t
  where has_table_privilege('anon', t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or (t <> 'public.keepalive' and has_table_privilege('anon', t, 'SELECT'))
     or (t <> 'public.keepalive' and not has_table_privilege('authenticated', t, 'SELECT'));
  perform pg_temp.check(v_bad is null, 'T30 table grants: ' || coalesce(v_bad, ''));

  select string_agg(t, ', ') into v_bad from unnest(v_tables) t
  where not exists (select 1 from pg_policy where polrelid = t::regclass);
  perform pg_temp.check(v_bad is null, 'T30 every table has a policy: ' || coalesce(v_bad, ''));

  perform pg_temp.check(not has_table_privilege('authenticated', 'private.team_removals', 'SELECT,INSERT,UPDATE,DELETE')
                        and not has_table_privilege('anon', 'private.team_removals', 'SELECT,INSERT,UPDATE,DELETE')
                        and (select relrowsecurity from pg_class where oid = 'private.team_removals'::regclass),
                        'T30 team_removals closed');

  perform pg_temp.check((select not public and file_size_limit = 262144
                                and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
                         from storage.buckets where id = 'team-photos'), 'T30 team-photos bucket is private and limited');

  -- Member changes lock the team row (the race itself needs two sessions; this checks the code).
  select string_agg(f, ', ') into v_bad
  from unnest(array['private.guard_last_manager()', 'public.leave_team(text)',
                    'public.set_member_role(text,uuid,text)', 'public.remove_member(text,uuid)',
                    'public.create_invite(text,text,integer)', 'public.join_team(text,text)',
                    'public.delete_my_account()']) f
  where pg_get_functiondef(f::regprocedure) !~* 'from public\.teams t\s.*for update';
  perform pg_temp.check(v_bad is null, 'T30 team row locked in: ' || coalesce(v_bad, ''));

  -- The role is checked again once the lock is held (audit H1): a call that waited behind the
  -- caller's own demotion or removal must not run with the old role.
  select string_agg(f, ', ') into v_bad
  from unnest(array['public.set_member_role(text,uuid,text)', 'public.remove_member(text,uuid)',
                    'public.create_invite(text,text,integer)']) f
  where pg_get_functiondef(f::regprocedure) !~* 'for update;.*is_team_manager';
  perform pg_temp.check(v_bad is null, 'T30 role checked again under the lock in: ' || coalesce(v_bad, ''));
  perform pg_temp.check(exists (select 1 from pg_trigger
                                where tgrelid = 'public.team_members'::regclass
                                  and tgname = 'team_members_revoke_invites' and not tgisinternal),
                        'T30 invite revocation trigger on team_members');
  -- The AFTER triggers on team_members also fire when an auth user is deleted in the dashboard,
  -- as `supabase_auth_admin`, which has no rights on these tables: they must run as their
  -- owner. (This script can't become that role on a hosted project, so it checks the functions.)
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'public.team_members'::regclass and not t.tgisinternal
    and (t.tgtype & 2) = 0 -- AFTER triggers
    and not p.prosecdef;
  perform pg_temp.check(v_bad is null, 'T30 after-triggers on team_members run as their owner: ' || coalesce(v_bad, ''));
  perform pg_temp.check(not has_table_privilege('supabase_auth_admin', 'public.team_members', 'select'),
                        'T30 (premise) the auth admin role has no rights on team_members');

  -- join_team locks the team row before the invite row (the order of the member changes that
  -- revoke codes), so the two can't deadlock.
  perform pg_temp.check(pg_get_functiondef('public.join_team(text,text)'::regprocedure)
                          ~* 'from public\.teams t\s.*for update.*from public\.invites i\s.*for update',
                        'T30 join_team locks the team before the invite');

  raise notice 'ALL RLS TESTS PASSED';
end $$;

select 'ALL RLS TESTS PASSED' as result;

rollback;
