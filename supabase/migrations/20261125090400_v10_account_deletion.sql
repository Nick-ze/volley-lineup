-- v10.0 — deleting an account (see docs/SUPABASE.md).
--
-- No Edge Function and no service-role key: the app
--   1. calls account_deletion_check() and shows the blocked teams, if any;
--   2. removes the photos of every team in `delete_teams` through the Storage API (managers may);
--   3. calls delete_my_account(), which deletes those teams and the auth user. The cascades remove
--      the user's memberships and live holds; their records stay, with `updated_by` set to null.

-- account_deletion_check: what deleting the caller's account would do.
--   blocked_teams: teams where the caller is the last manager and other members remain;
--   delete_teams:  teams where the caller is the only member (deleted with the account).
-- SECURITY INVOKER: RLS already shows the caller every member of their own teams.
create function public.account_deletion_check()
  returns jsonb
  language plpgsql stable security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'delete_teams', coalesce((
      select jsonb_agg(m.team_id order by m.team_id) from public.team_members m
      where m.user_id = v_uid
        and not exists (select 1 from public.team_members o
                        where o.team_id = m.team_id and o.user_id <> v_uid)), '[]'::jsonb),
    'blocked_teams', coalesce((
      select jsonb_agg(m.team_id order by m.team_id) from public.team_members m
      where m.user_id = v_uid and m.role = 'manager'
        and not exists (select 1 from public.team_members o
                        where o.team_id = m.team_id and o.user_id <> v_uid
                          and o.role = 'manager')
        and exists (select 1 from public.team_members o
                    where o.team_id = m.team_id and o.user_id <> v_uid)), '[]'::jsonb));
end $$;

-- delete_my_account: deletes the caller's account. VL001 (detail: the blocked team ids, comma
-- separated) while the caller is the last manager of a team with other members; VL008 (detail:
-- team ids) while photos of a team it would delete remain. Otherwise it deletes the teams where
-- the caller is the only member, then the auth user (sessions, identities, memberships, holds and
-- removal entries cascade). Returns the deleted team ids.
create function public.delete_my_account()
  returns text[]
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_blocked text[];
  v_sole text[];
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Lock the caller's teams (in id order, so two deletions can't deadlock) like every member
  -- change does: no concurrent role change or removal can slip in between check and delete.
  perform 1 from public.teams t
  where t.id in (select m.team_id from public.team_members m where m.user_id = v_uid)
  order by t.id
  for update;

  select coalesce(array_agg(m.team_id order by m.team_id), '{}') into v_blocked
  from public.team_members m
  where m.user_id = v_uid and m.role = 'manager'
    and not exists (select 1 from public.team_members o
                    where o.team_id = m.team_id and o.user_id <> v_uid and o.role = 'manager')
    and exists (select 1 from public.team_members o
                where o.team_id = m.team_id and o.user_id <> v_uid);
  if cardinality(v_blocked) > 0 then
    raise exception 'last_manager' using errcode = 'VL001',
      detail = array_to_string(v_blocked, ',');
  end if;

  select coalesce(array_agg(m.team_id order by m.team_id), '{}') into v_sole
  from public.team_members m
  where m.user_id = v_uid
    and not exists (select 1 from public.team_members o
                    where o.team_id = m.team_id and o.user_id <> v_uid);
  if exists (select 1 from unnest(v_sole) s (team_id)
             where private.team_photo_count(s.team_id) > 0) then
    raise exception 'photos_remain' using errcode = 'VL008',
      detail = (select string_agg(s.team_id, ',' order by s.team_id) from unnest(v_sole) s (team_id)
                where private.team_photo_count(s.team_id) > 0);
  end if;

  perform set_config('app.bypass_member_guard', 'on', true);
  delete from public.teams t where t.id = any (v_sole);
  delete from auth.users u where u.id = v_uid;
  perform set_config('app.bypass_member_guard', 'off', true);
  return v_sole;
end $$;

revoke all on function public.account_deletion_check(), public.delete_my_account()
  from public, anon;
grant execute on function public.account_deletion_check(), public.delete_my_account()
  to authenticated;
