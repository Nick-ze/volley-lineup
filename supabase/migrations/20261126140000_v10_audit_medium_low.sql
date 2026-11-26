-- v10 audit, medium / low findings (docs/AUDIT_V10.md "Medium / low fix log", DECISIONS #316).
--
-- M9  delete_team checked the caller's role before it locked the team row, so a call that waited
--     behind the caller's own demotion or removal still deleted the team. It now checks again
--     once it holds the lock, like set_member_role / remove_member / create_invite since
--     20261126120000_v10_audit_invite_revocation.sql.
-- L1  Tables that `postgres` creates in `public` no longer give `anon`, `authenticated` and
--     `service_role` TRUNCATE / REFERENCES / TRIGGER / MAINTAIN by default. Every migration
--     grants explicitly anyway; this protects a future one that forgets `revoke all`. Existing
--     tables are not changed (their grants were already revoked per table).
-- L2  `public.rls_auto_enable()` (Supabase's event-trigger function for "enable RLS on new
--     tables") is no longer executable through the API. The event trigger still runs it: EXECUTE
--     is only checked for calls, and its owner keeps the right. Skipped where the function
--     doesn't exist (a self-hosted or local project without that option).
--
-- Nothing is dropped and no row is changed. Apply after 20261126130000_v10_audit_member_triggers.sql.

-- ---------------------------------------------------------------------------------------------
-- M9: delete_team — the role is checked again under the team's row lock.
-- ---------------------------------------------------------------------------------------------

create or replace function public.delete_team(p_team_id text)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.teams t where t.id = p_team_id for update; -- serialize member changes
  if not private.is_team_manager(p_team_id) then -- changed while waiting for the lock
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if private.team_photo_count(p_team_id) > 0 then
    raise exception 'photos_remain' using errcode = 'VL008', detail = p_team_id;
  end if;
  perform set_config('app.bypass_member_guard', 'on', true);
  delete from public.teams where id = p_team_id;
  perform set_config('app.bypass_member_guard', 'off', true);
end $$;

-- `create or replace` keeps the owner and the grants; stated again so this file reads alone.
revoke all on function public.delete_team(text) from public, anon;
grant execute on function public.delete_team(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- L1: default privileges of tables `postgres` creates in `public`.
-- ---------------------------------------------------------------------------------------------

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- L2: Supabase's rls_auto_enable() is not an API function.
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
