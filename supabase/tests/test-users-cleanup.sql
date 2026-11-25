-- Deletes the test users from supabase/tests/test-users.sql and the teams only they belong to.
-- Run as `postgres`. Safe to run more than once.
--
-- Cascades remove their identities, sessions, memberships and live holds. Teams that also have
-- real members stay; the result lists any of those that are left without a manager. Photos in
-- deleted teams' storage folders are not removed (the live check uploads none); remove them in
-- the dashboard (Storage → team-photos) if a test uploaded some.

begin;

create temporary table vl_test_users on commit drop as
select id from auth.users
where id in ('e2e00000-0000-4000-8000-000000000001', 'e2e00000-0000-4000-8000-000000000002',
             'e2e00000-0000-4000-8000-000000000003');

-- Like delete_my_account: skip the last-manager guard for this transaction.
select set_config('app.bypass_member_guard', 'on', true);

delete from public.teams t
where exists (select 1 from public.team_members m
              where m.team_id = t.id and m.user_id in (select id from vl_test_users))
  and not exists (select 1 from public.team_members m
                  where m.team_id = t.id and m.user_id not in (select id from vl_test_users));

delete from auth.users where id in (select id from vl_test_users);

select set_config('app.bypass_member_guard', 'off', true);

select 'deleted test users' as result, (select count(*) from vl_test_users) as users,
       (select coalesce(string_agg(t.id, ', '), '') from public.teams t
        where not exists (select 1 from public.team_members m
                          where m.team_id = t.id and m.role = 'manager')) as teams_without_manager;

commit;
