-- RLS and RPC tests for shared hosted tournaments (TT1–TT14). See docs/SUPABASE.md.
--
-- Run as `postgres` on a database that has every file in supabase/migrations applied (SQL
-- editor, `psql -v ON_ERROR_STOP=1 -f supabase/tests/tournaments.sql`, or the MCP tool
-- `execute_sql`). Everything happens inside one transaction that is rolled back at the end, so
-- the script leaves nothing behind. It creates its own users in auth.users (fixed ids,
-- *@example.test).
--
-- A failing check raises an exception whose message starts with "FAIL TT<n>". When every check
-- passes, the last result is 'ALL TOURNAMENT TESTS PASSED'.
--
-- Users: H (host of tour-a), H2 (host of tour-b), G (guest of tour-a), S (stranger).

begin;

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

create function pg_temp.as_user(p_user uuid) returns void
  language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A place for values that must survive a change of role (the invite codes).
create temp table tt_notes (key text primary key, value text);
grant all on tt_notes to authenticated;

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
from (values ('b0000000-0000-4000-8000-000000000001'::uuid, 'tt-h@example.test'),
             ('b0000000-0000-4000-8000-000000000002'::uuid, 'tt-h2@example.test'),
             ('b0000000-0000-4000-8000-000000000003'::uuid, 'tt-g@example.test'),
             ('b0000000-0000-4000-8000-000000000004'::uuid, 'tt-s@example.test')) u (id, email);

-- ---------------------------------------------------------------------------------------------
-- TT1 create
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.create_tournament('tour-a', '  Hanna  ') = 'created', 'TT1 H creates tour-a');
  perform pg_temp.check(public.create_tournament('tour-a', 'Hanna') = 'member', 'TT1 again: member');
  perform pg_temp.check((select role || ':' || display_name from public.tournament_members
                         where tournament_id = 'tour-a') = 'host:Hanna', 'TT1 H is host, name trimmed');
  perform pg_temp.expect_error('TT1 bad id', $q$select public.create_tournament('a/b', 'x')$q$, '23514');
end $$;

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.create_tournament('tour-a', 'Hugo') = 'taken', 'TT1 H2: tour-a is taken');
  perform pg_temp.check(public.create_tournament('tour-b', 'Hugo') = 'created', 'TT1 H2 creates tour-b');
end $$;

reset role; select set_config('request.jwt.claims', '{}', true); set local role authenticated;
select pg_temp.expect_error('TT1 no user', $q$select public.create_tournament('tour-x', 'x')$q$, '42501');

-- ---------------------------------------------------------------------------------------------
-- TT2 the host pushes every kind
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  v jsonb;
begin
  v := public.push_tournament_records('tour-a', 'dev-h', jsonb_build_array(
    jsonb_build_object('kind', 'tournament', 'id', 'tour-a', 'at', '2026-11-28T10:00:00.000Z',
                       'payload', jsonb_build_object('name', 'Cup')),
    jsonb_build_object('kind', 'team', 'id', 't1', 'at', '2026-11-28T10:00:00.000Z',
                       'payload', jsonb_build_object('name', 'One', 'order', 0)),
    jsonb_build_object('kind', 'team', 'id', 't2', 'at', '2026-11-28T10:00:00.000Z',
                       'payload', jsonb_build_object('name', 'Two', 'order', 1)),
    jsonb_build_object('kind', 'player', 'id', 'p1', 'at', '2026-11-28T10:00:00.000Z',
                       'payload', jsonb_build_object('teamId', 't1', 'number', 6)),
    jsonb_build_object('kind', 'result', 'id', 'r1', 'at', '2026-11-28T10:00:00.000Z',
                       'payload', jsonb_build_object('teamAId', 't1', 'teamBId', 't2', 'sets', '[]'::jsonb))));
  perform pg_temp.check(jsonb_array_length(v) = 5, 'TT2 five results');
  perform pg_temp.check((select bool_and((e ->> 'applied')::boolean) from jsonb_array_elements(v) e), 'TT2 all applied');
  perform pg_temp.check(v -> 0 ->> 'at' = '2026-11-28T10:00:00.000Z', 'TT2 the at comes back as sent');
  perform pg_temp.check(not (v -> 0 ? 'payload'), 'TT2 no payload for an applied record');
  perform pg_temp.check((select count(*) from public.tournament_records where tournament_id = 'tour-a') = 5, 'TT2 five rows');
  perform pg_temp.check((select payload_bytes from public.tournaments where id = 'tour-a') > 5 * 512, 'TT2 bytes counted');

  perform pg_temp.expect_error('TT2 not an array', $q$select public.push_tournament_records('tour-a', 'd', '{}'::jsonb)$q$, '22023');
  perform pg_temp.expect_error('TT2 unknown kind', $q$select public.push_tournament_records('tour-a', 'd',
    '[{"kind":"match","id":"m","at":"2026-11-28T10:00:00Z","payload":{}}]')$q$, '22023');
  perform pg_temp.expect_error('TT2 tournament tombstone', $q$select public.push_tournament_records('tour-a', 'd',
    '[{"kind":"tournament","id":"tour-a","at":"2026-11-28T11:00:00Z","deleted":true}]')$q$, '22023');
  perform pg_temp.expect_error('TT2 tournament record of another id', $q$select public.push_tournament_records('tour-a', 'd',
    '[{"kind":"tournament","id":"tour-b","at":"2026-11-28T11:00:00Z","payload":{}}]')$q$, '22023');
  perform pg_temp.expect_error('TT2 bad at', $q$select public.push_tournament_records('tour-a', 'd',
    '[{"kind":"team","id":"t9","at":"not a time","payload":{}}]')$q$, '22023');
  perform pg_temp.expect_error('TT2 infinite at', $q$select public.push_tournament_records('tour-a', 'd',
    '[{"kind":"team","id":"t9","at":"infinity","payload":{}}]')$q$, '22023');
  perform pg_temp.expect_error('TT2 payload not an object', $q$select public.push_tournament_records('tour-a', 'd',
    '[{"kind":"team","id":"t9","at":"2026-11-28T10:00:00Z","payload":[1]}]')$q$, '23514');
  perform pg_temp.expect_error('TT2 H can''t push to tour-b', $q$select public.push_tournament_records('tour-b', 'd', '[]')$q$, '42501');
  perform pg_temp.expect_error('TT2 direct insert', $q$insert into public.tournament_records
    (tournament_id, kind, id, payload, client_updated_at) values ('tour-a', 'team', 'zz', '{}', now())$q$, '42501');
  perform pg_temp.expect_error('TT2 direct update', $q$update public.tournament_records set payload = '{}'$q$, '42501');
  perform pg_temp.expect_error('TT2 direct delete', $q$delete from public.tournaments$q$, '42501');
end $$;

-- ---------------------------------------------------------------------------------------------
-- TT3 strangers and the other host see nothing of tour-a
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from public.tournaments) = 0, 'TT3 S sees no tournaments');
  perform pg_temp.check((select count(*) from public.tournament_members) = 0, 'TT3 S sees no members');
  perform pg_temp.check((select count(*) from public.tournament_records) = 0, 'TT3 S sees no records');
  perform pg_temp.check((select count(*) from public.tournament_invites) = 0, 'TT3 S sees no invites');
  perform pg_temp.check(jsonb_array_length(public.pull_tournament_changes('tour-a', 0) -> 'rows') = 0, 'TT3 S pulls nothing');
  perform pg_temp.expect_error('TT3 S push', $q$select public.push_tournament_records('tour-a', 'd', '[]')$q$, '42501');
  perform pg_temp.expect_error('TT3 S delete', $q$select public.delete_tournament('tour-a')$q$, '42501');
  perform pg_temp.expect_error('TT3 S invite', $q$select public.create_tournament_invite('tour-a')$q$, '42501');
  perform pg_temp.expect_error('TT3 S leave', $q$select public.leave_tournament('tour-a')$q$, '42501');
end $$;

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select array_agg(id) from public.tournaments) = array['tour-b'], 'TT3 H2 sees only tour-b');
  perform pg_temp.check((select count(*) from public.tournament_records) = 0, 'TT3 H2 sees no records of tour-a');
  perform pg_temp.expect_error('TT3 H2 remove', $q$select public.remove_tournament_member('tour-a', 'b0000000-0000-4000-8000-000000000001')$q$, '42501');
end $$;

reset role; set local role anon;
select pg_temp.expect_error('TT3 anon table', $q$select count(*) from public.tournament_records$q$, '42501');
select pg_temp.expect_error('TT3 anon rpc', $q$select public.pull_tournament_changes('tour-a', 0)$q$, '42501');

-- ---------------------------------------------------------------------------------------------
-- TT4 invite codes
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  v jsonb;
begin
  v := public.create_tournament_invite('tour-a', 3);
  perform pg_temp.check(v ->> 'code' ~ '^[A-HJ-NP-Z2-9]{10}$', 'TT4 code format');
  perform pg_temp.check((v ->> 'expires_at')::timestamptz between now() + interval '2 days 23 hours' and now() + interval '3 days 1 hour', 'TT4 expiry');
  insert into tt_notes values ('code1', v ->> 'code'), ('invite1', v ->> 'id');
  perform pg_temp.check((select count(*) from public.tournament_invites) = 1, 'TT4 H sees the invite');
  perform pg_temp.expect_error('TT4 0 days', $q$select public.create_tournament_invite('tour-a', 0)$q$, '22023');
  perform pg_temp.expect_error('TT4 31 days', $q$select public.create_tournament_invite('tour-a', 31)$q$, '22023');
  perform pg_temp.expect_error('TT4 H invite for tour-b', $q$select public.create_tournament_invite('tour-b', 3)$q$, '42501');
end $$;

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
declare
  v jsonb;
  v_code text := (select value from tt_notes where key = 'code1');
begin
  perform pg_temp.expect_error('TT4 unknown code', $q$select public.join_tournament('AAAAAAAAAA', 'Gil')$q$, 'VL002');
  -- Lower case, a dash and spaces are ignored.
  v := public.join_tournament(' ' || lower(substr(v_code, 1, 5)) || '-' || substr(v_code, 6) || ' ', 'Gil');
  perform pg_temp.check(v = jsonb_build_object('tournament_id', 'tour-a', 'role', 'scorer'), 'TT4 G joins as scorer');
  v := public.join_tournament(v_code, '');
  perform pg_temp.check(v ->> 'role' = 'scorer', 'TT4 G joins again');
  perform pg_temp.check((select display_name from public.tournament_members
                         where user_id = 'b0000000-0000-4000-8000-000000000003') = 'Gil', 'TT4 an empty name keeps the old one');
  perform pg_temp.check((select count(*) from public.tournament_members) = 2, 'TT4 G sees both members');
  perform pg_temp.check((select count(*) from public.tournament_invites) = 0, 'TT4 G sees no invites');
end $$;

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  v jsonb;
begin
  v := public.join_tournament((select value from tt_notes where key = 'code1'), 'Hanna');
  perform pg_temp.check(v ->> 'role' = 'host', 'TT4 the host using a code stays host');
  perform pg_temp.check((select uses from public.tournament_invites) = 3, 'TT4 uses counted');
end $$;

-- ---------------------------------------------------------------------------------------------
-- TT5 a scorer reads everything and writes results only
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
declare
  v jsonb;
begin
  v := public.pull_tournament_changes('tour-a', 0);
  perform pg_temp.check(jsonb_array_length(v -> 'rows') = 5, 'TT5 G pulls five rows');
  perform pg_temp.check((v -> 'rows' -> 0 ->> 'version')::bigint < (v -> 'rows' -> 4 ->> 'version')::bigint, 'TT5 oldest first');
  perform pg_temp.check(v ->> 'server_now' ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$', 'TT5 server_now format');
  perform pg_temp.check(jsonb_array_length(public.pull_tournament_changes('tour-a', 0, 2) -> 'rows') = 2, 'TT5 limit');
  perform pg_temp.check(jsonb_array_length(public.pull_tournament_changes('tour-a',
    (v -> 'rows' -> 4 ->> 'version')::bigint) -> 'rows') = 0, 'TT5 nothing after the last version');

  v := public.push_tournament_records('tour-a', 'dev-g', jsonb_build_array(
    jsonb_build_object('kind', 'result', 'id', 'r1', 'at', '2026-11-28T10:05:00.000Z',
                       'payload', jsonb_build_object('teamAId', 't1', 'teamBId', 't2',
                                                     'sets', '[{"a":25,"b":20}]'::jsonb)),
    jsonb_build_object('kind', 'result', 'id', 'r2', 'at', '2026-11-28T10:05:00.000Z',
                       'payload', jsonb_build_object('teamAId', 't1', 'teamBId', 't2', 'sets', '[]'::jsonb))));
  perform pg_temp.check((v -> 0 ->> 'applied')::boolean and (v -> 1 ->> 'applied')::boolean, 'TT5 G writes results');
  v := public.push_tournament_records('tour-a', 'dev-g',
    '[{"kind":"result","id":"r2","at":"2026-11-28T10:06:00.000Z","deleted":true}]');
  perform pg_temp.check((v -> 0 ->> 'applied')::boolean and (v -> 0 ->> 'deleted')::boolean, 'TT5 G deletes a result');

  perform pg_temp.expect_error('TT5 G team', $q$select public.push_tournament_records('tour-a', 'dev-g',
    '[{"kind":"team","id":"t1","at":"2026-11-28T12:00:00Z","payload":{"name":"Hacked","order":0}}]')$q$, '42501');
  perform pg_temp.expect_error('TT5 G player', $q$select public.push_tournament_records('tour-a', 'dev-g',
    '[{"kind":"player","id":"p1","at":"2026-11-28T12:00:00Z","deleted":true}]')$q$, '42501');
  perform pg_temp.expect_error('TT5 G tournament', $q$select public.push_tournament_records('tour-a', 'dev-g',
    '[{"kind":"tournament","id":"tour-a","at":"2026-11-28T12:00:00Z","payload":{"name":"Mine"}}]')$q$, '42501');
  perform pg_temp.expect_error('TT5 a mixed batch is refused as a whole', $q$select public.push_tournament_records('tour-a', 'dev-g',
    '[{"kind":"result","id":"r3","at":"2026-11-28T12:00:00Z","payload":{"sets":[]}},
      {"kind":"team","id":"t3","at":"2026-11-28T12:00:00Z","payload":{"name":"X","order":2}}]')$q$, '42501');
  perform pg_temp.check(not exists (select 1 from public.tournament_records where id = 'r3'), 'TT5 nothing of the mixed batch was written');
  perform pg_temp.check((select payload ->> 'name' from public.tournament_records where kind = 'team' and id = 't1') = 'One', 'TT5 the team is unchanged');

  perform pg_temp.expect_error('TT5 G delete', $q$select public.delete_tournament('tour-a')$q$, '42501');
  perform pg_temp.expect_error('TT5 G invite', $q$select public.create_tournament_invite('tour-a')$q$, '42501');
  perform pg_temp.expect_error('TT5 G revoke', format('select public.revoke_tournament_invite(%L)',
    (select value from tt_notes where key = 'invite1')), '42501');
  perform pg_temp.expect_error('TT5 G removes the host', $q$select public.remove_tournament_member('tour-a', 'b0000000-0000-4000-8000-000000000001')$q$, '42501');
end $$;

-- ---------------------------------------------------------------------------------------------
-- TT6 last write wins by (at, device)
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  v jsonb;
  v_before bigint := (select version from public.tournament_records where kind = 'result' and id = 'r1');
begin
  -- Older than the scorer's save: kept, and the server's content comes back.
  v := public.push_tournament_records('tour-a', 'dev-h',
    '[{"kind":"result","id":"r1","at":"2026-11-28T10:04:00.000Z","payload":{"teamAId":"t1","teamBId":"t2","sets":[]}}]');
  perform pg_temp.check(not (v -> 0 ->> 'applied')::boolean, 'TT6 an older save is not applied');
  perform pg_temp.check(v -> 0 -> 'payload' -> 'sets' -> 0 ->> 'a' = '25', 'TT6 the stored payload comes back');
  perform pg_temp.check(v -> 0 ->> 'device_id' = 'dev-g', 'TT6 with its device');
  perform pg_temp.check((v -> 0 ->> 'version')::bigint = v_before, 'TT6 the version is unchanged');
  -- The same time: the larger device id wins ('dev-h' > 'dev-g').
  v := public.push_tournament_records('tour-a', 'dev-h',
    '[{"kind":"result","id":"r1","at":"2026-11-28T10:05:00.000Z","payload":{"teamAId":"t1","teamBId":"t2","sets":[{"a":25,"b":22}]}}]');
  perform pg_temp.check((v -> 0 ->> 'applied')::boolean, 'TT6 same time, larger device id wins');
  perform pg_temp.check((v -> 0 ->> 'version')::bigint > v_before, 'TT6 a new version');
  -- A time far in the future is clamped to one minute ahead.
  v := public.push_tournament_records('tour-a', 'dev-h',
    '[{"kind":"team","id":"t2","at":"2099-01-01T00:00:00.000Z","payload":{"name":"Two","order":1}}]');
  perform pg_temp.check((v -> 0 ->> 'at')::timestamptz <= now() + interval '61 seconds', 'TT6 a future time is clamped');
  -- A tombstone can be written over by a newer save.
  v := public.push_tournament_records('tour-a', 'dev-h',
    '[{"kind":"result","id":"r2","at":"2026-11-28T10:07:00.000Z","payload":{"teamAId":"t1","teamBId":"t2","sets":[]}}]');
  perform pg_temp.check((v -> 0 ->> 'applied')::boolean and not (v -> 0 ->> 'deleted')::boolean, 'TT6 a deleted record comes back');
end $$;

-- ---------------------------------------------------------------------------------------------
-- TT7 leaving and removing
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform pg_temp.expect_error('TT7 the host can''t leave', $q$select public.leave_tournament('tour-a')$q$, '42501');
  perform pg_temp.expect_error('TT7 the host can''t remove themselves', $q$select public.remove_tournament_member('tour-a', 'b0000000-0000-4000-8000-000000000001')$q$, '22023');
  -- A missing member is a no-op and revokes nothing.
  perform public.remove_tournament_member('tour-a', 'b0000000-0000-4000-8000-000000000004');
  perform pg_temp.check((select revoked_at is null from public.tournament_invites), 'TT7 no-op removal keeps the code');
  perform public.remove_tournament_member('tour-a', 'b0000000-0000-4000-8000-000000000003');
  perform pg_temp.check((select count(*) from public.tournament_members where tournament_id = 'tour-a') = 1, 'TT7 G is removed');
  perform pg_temp.check((select revoked_at is not null from public.tournament_invites), 'TT7 the code is revoked');
end $$;

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.check((select count(*) from public.tournament_records) = 0, 'TT7 G sees nothing any more');
  perform pg_temp.expect_error('TT7 G can''t push', $q$select public.push_tournament_records('tour-a', 'dev-g', '[]')$q$, '42501');
  perform pg_temp.expect_error('TT7 the old code is dead', format('select public.join_tournament(%L, %L)',
    (select value from tt_notes where key = 'code1'), 'Gil'), 'VL002');
end $$;

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  v jsonb := public.create_tournament_invite('tour-a');
begin
  insert into tt_notes values ('code2', v ->> 'code'), ('invite2', v ->> 'id');
end $$;

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000003'); set local role authenticated;
do $$
begin
  perform pg_temp.check(public.join_tournament((select value from tt_notes where key = 'code2'), 'Gil') ->> 'role' = 'scorer', 'TT7 a new code lets G back in');
  perform public.leave_tournament('tour-a');
  perform pg_temp.check((select count(*) from public.tournaments) = 0, 'TT7 G left');
  perform pg_temp.check(public.join_tournament((select value from tt_notes where key = 'code2'), 'Gil') ->> 'role' = 'scorer', 'TT7 leaving revokes nothing');
end $$;

-- ---------------------------------------------------------------------------------------------
-- TT8 revoked and expired codes
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
begin
  perform public.revoke_tournament_invite((select value from tt_notes where key = 'invite2')::uuid);
  perform public.revoke_tournament_invite((select value from tt_notes where key = 'invite2')::uuid); -- idempotent
  perform pg_temp.expect_error('TT8 unknown invite', $q$select public.revoke_tournament_invite('c0000000-0000-4000-8000-000000000000')$q$, '42501');
end $$;

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000004'); set local role authenticated;
select pg_temp.expect_error('TT8 a revoked code', format('select public.join_tournament(%L, %L)',
  (select value from tt_notes where key = 'code2'), 'Sam'), 'VL002');

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
do $$
declare
  v jsonb := public.create_tournament_invite('tour-a', 1);
begin
  insert into tt_notes values ('code3', v ->> 'code'), ('invite3', v ->> 'id');
end $$;
reset role;
update public.tournament_invites set created_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where id = (select value from tt_notes where key = 'invite3')::uuid;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000004'); set local role authenticated;
select pg_temp.expect_error('TT8 an expired code', format('select public.join_tournament(%L, %L)',
  (select value from tt_notes where key = 'code3'), 'Sam'), 'VL002');

-- ---------------------------------------------------------------------------------------------
-- TT9 limits
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
begin
  for i in 1..20 loop
    perform pg_temp.check(public.create_tournament('s-tour-' || i, 'Sam') = 'created', 'TT9 create ' || i);
  end loop;
  perform pg_temp.expect_error('TT9 the 21st tournament', $q$select public.create_tournament('s-tour-21', 'Sam')$q$, 'VL006');
  perform pg_temp.expect_error('TT9 201 records in a batch', format('select public.push_tournament_records(%L, %L, %L::jsonb)',
    's-tour-1', 'd', (select jsonb_agg(jsonb_build_object('kind', 'team', 'id', 't' || n, 'at', '2026-11-28T10:00:00Z', 'payload', '{}'::jsonb))
                      from generate_series(1, 201) n)), '22023');
  perform pg_temp.expect_error('TT9 a payload over 64 kB', format('select public.push_tournament_records(%L, %L, %L::jsonb)',
    's-tour-1', 'd', jsonb_build_array(jsonb_build_object('kind', 'team', 'id', 'big', 'at', '2026-11-28T10:00:00Z',
                                                          'payload', jsonb_build_object('name', repeat('x', 66000))))), '23514');
  for i in 1..20 loop
    perform public.create_tournament_invite('s-tour-1', 1);
  end loop;
  perform pg_temp.expect_error('TT9 the 21st open code', $q$select public.create_tournament_invite('s-tour-1', 1)$q$, 'VL007');
end $$;

-- The record limit (2 000) and the size limit (5 MB), with rows written as the owner.
reset role;
insert into public.tournament_records (tournament_id, kind, id, payload, client_updated_at)
select 's-tour-2', 'result', 'r' || n, '{}'::jsonb, now() from generate_series(1, 1999) n;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000004'); set local role authenticated;
do $$
declare
  v jsonb;
begin
  v := public.push_tournament_records('s-tour-2', 'd',
    '[{"kind":"result","id":"r2000","at":"2026-11-28T10:00:00Z","payload":{}},
      {"kind":"result","id":"r1","at":"2026-11-28T10:00:00Z","payload":{}}]');
  perform pg_temp.check(jsonb_array_length(v) = 2, 'TT9 the 2000th record fits');
  perform pg_temp.expect_error('TT9 the 2001st record', $q$select public.push_tournament_records('s-tour-2', 'd',
    '[{"kind":"result","id":"r2001","at":"2026-11-28T10:00:00Z","payload":{}}]')$q$, 'VL007');
end $$;
reset role;
update public.tournaments set payload_bytes = 5 * 1024 * 1024 - 100 where id = 's-tour-3';
select pg_temp.as_user('b0000000-0000-4000-8000-000000000004'); set local role authenticated;
select pg_temp.expect_error('TT9 over 5 MB', $q$select public.push_tournament_records('s-tour-3', 'd',
  '[{"kind":"team","id":"t1","at":"2026-11-28T10:00:00Z","payload":{"name":"x"}}]')$q$, 'VL007');

-- ---------------------------------------------------------------------------------------------
-- TT10 fifty members at most
-- ---------------------------------------------------------------------------------------------

reset role;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ('b1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'authenticated', 'authenticated', 'tt-m' || n || '@example.test', now(), now()
from generate_series(1, 48) n;
insert into public.tournament_members (tournament_id, user_id, role)
select 'tour-b', ('b1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'scorer'
from generate_series(1, 48) n;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000002'); set local role authenticated;
do $$
declare
  v jsonb := public.create_tournament_invite('tour-b', 1);
begin
  insert into tt_notes values ('codeb', v ->> 'code');
end $$;
reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000003'); set local role authenticated;
select pg_temp.check(public.join_tournament((select value from tt_notes where key = 'codeb'), 'Gil') ->> 'role' = 'scorer', 'TT10 the 50th member joins');
reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000004'); set local role authenticated;
select pg_temp.expect_error('TT10 the 51st member', format('select public.join_tournament(%L, %L)',
  (select value from tt_notes where key = 'codeb'), 'Sam'), 'VL007');
reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000003'); set local role authenticated;
select pg_temp.check(public.join_tournament((select value from tt_notes where key = 'codeb'), 'Gil') ->> 'role' = 'scorer', 'TT10 a member can use the code again when it is full');

-- ---------------------------------------------------------------------------------------------
-- TT11 delete_tournament removes everything of it, for everyone
-- ---------------------------------------------------------------------------------------------

reset role; select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
select public.delete_tournament('tour-a');
reset role;
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.tournaments where id = 'tour-a'), 'TT11 tournament gone');
  perform pg_temp.check(not exists (select 1 from public.tournament_members where tournament_id = 'tour-a'), 'TT11 members gone');
  perform pg_temp.check(not exists (select 1 from public.tournament_records where tournament_id = 'tour-a'), 'TT11 records gone');
  perform pg_temp.check(not exists (select 1 from public.tournament_invites where tournament_id = 'tour-a'), 'TT11 invites gone');
  perform pg_temp.check(exists (select 1 from public.tournaments where id = 'tour-b'), 'TT11 tour-b stays');
end $$;
select pg_temp.as_user('b0000000-0000-4000-8000-000000000001'); set local role authenticated;
select pg_temp.check(public.create_tournament('tour-a', 'Hanna') = 'created', 'TT11 the id is free again');

-- ---------------------------------------------------------------------------------------------
-- TT12 deleting an account: a host's tournaments go, a guest's membership goes
-- ---------------------------------------------------------------------------------------------

reset role;
delete from auth.users where id = 'b0000000-0000-4000-8000-000000000003'; -- G, a guest of tour-b
do $$
begin
  perform pg_temp.check(exists (select 1 from public.tournaments where id = 'tour-b'), 'TT12 tour-b survives its guest');
  perform pg_temp.check((select count(*) from public.tournament_members where tournament_id = 'tour-b') = 49, 'TT12 the guest''s membership is gone');
end $$;
delete from auth.users where id = 'b0000000-0000-4000-8000-000000000002'; -- H2, the host of tour-b
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.tournaments where id = 'tour-b'), 'TT12 tour-b goes with its host');
  perform pg_temp.check(not exists (select 1 from public.tournament_members where tournament_id = 'tour-b'), 'TT12 and its members');
end $$;
-- delete_my_account (v10) still works for a user with tournaments.
select pg_temp.as_user('b0000000-0000-4000-8000-000000000004'); set local role authenticated;
select public.delete_my_account();
reset role;
select pg_temp.check(not exists (select 1 from public.tournaments where id like 's-tour-%'), 'TT12 delete_my_account removes the hosted tournaments');

-- ---------------------------------------------------------------------------------------------
-- TT13 privileges: nothing for anon, SELECT only for authenticated, private helpers not callable
-- ---------------------------------------------------------------------------------------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array['tournaments', 'tournament_members', 'tournament_invites', 'tournament_records'] loop
    perform pg_temp.check(not has_table_privilege('anon', 'public.' || v_table, 'select'), 'TT13 anon select ' || v_table);
    perform pg_temp.check(has_table_privilege('authenticated', 'public.' || v_table, 'select'), 'TT13 authenticated select ' || v_table);
    perform pg_temp.check(not has_table_privilege('authenticated', 'public.' || v_table, 'insert, update, delete, truncate'), 'TT13 authenticated write ' || v_table);
    perform pg_temp.check((select relrowsecurity from pg_class where oid = ('public.' || v_table)::regclass), 'TT13 RLS on ' || v_table);
  end loop;
  perform pg_temp.check(not has_function_privilege('anon', 'public.join_tournament(text, text)', 'execute'), 'TT13 anon can''t join');
  perform pg_temp.check(not has_function_privilege('authenticated', 'private.stamp_tournament_record()', 'execute'), 'TT13 trigger function not callable');
  perform pg_temp.check(not has_sequence_privilege('authenticated', 'public.tournament_records_version_seq', 'usage'), 'TT13 sequence not usable');
end $$;

-- ---------------------------------------------------------------------------------------------
-- TT14 the team tables of v10 are untouched by tournament calls
-- ---------------------------------------------------------------------------------------------

select pg_temp.check((select count(*) from public.teams where id like 'tour-%' or id like 's-tour-%') = 0, 'TT14 no team rows');

select 'ALL TOURNAMENT TESTS PASSED' as result;

rollback;
