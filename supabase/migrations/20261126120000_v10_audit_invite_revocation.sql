-- v10 audit fix H1 (docs/AUDIT_V10.md, DECISIONS #292): invite codes must not outlive the access
-- of the people who know them.
--
-- Before this migration:
--   * a manager who was made a player could use any unused manager code (managers see every
--     code, and can create one for themselves first) and was a manager again;
--   * a removed member was only refused under the same account: a second account (another email
--     address) got back in with any code that still worked.
--
-- Now:
--   * when someone stops being a manager of a team (made a player, removed, left, account
--     deleted), the team's open manager codes are revoked (trigger on team_members);
--   * remove_member revokes every open code of the team, player codes too;
--   * create_invite, set_member_role and remove_member check the caller's role again after
--     taking the team's row lock, so a call that was waiting behind the caller's own demotion or
--     removal is refused instead of running with the old role;
--   * join_team takes the team's row lock before the invite's, the same order as the member
--     changes that revoke codes, so a join can't deadlock with a removal and always sees it.
--
-- Nothing is dropped; no data is changed except `invites.revoked_at` when the rules above fire.
-- Apply after 20261125090600_v10_keepalive.sql.

-- ---------------------------------------------------------------------------------------------
-- Someone stops being a manager: the team's open manager codes are revoked.
-- ---------------------------------------------------------------------------------------------

create function private.revoke_manager_invites() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if old.role = 'manager' and (tg_op = 'DELETE' or new.role <> 'manager') then
    update public.invites i set revoked_at = now()
    where i.team_id = old.team_id and i.role = 'manager'
      and i.revoked_at is null and i.expires_at > now();
  end if;
  return null;
end $$;
revoke all on function private.revoke_manager_invites() from public, anon, authenticated;

create trigger team_members_revoke_invites
  after update of role or delete on public.team_members
  for each row execute function private.revoke_manager_invites();

-- ---------------------------------------------------------------------------------------------
-- RPCs: the role is checked again under the team's row lock.
-- ---------------------------------------------------------------------------------------------

-- set_member_role: as before; a caller who lost the manager role while waiting for the lock is
-- refused (42501).
create or replace function public.set_member_role(p_team_id text, p_user_id uuid, p_role text)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('manager', 'player') then
    raise exception 'bad_role' using errcode = '22023';
  end if;
  perform 1 from public.teams t where t.id = p_team_id for update; -- serialize member changes
  if not private.is_team_manager(p_team_id) then -- changed while waiting for the lock
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.team_members set role = p_role
  where team_id = p_team_id and user_id = p_user_id and role <> p_role;
end $$;

-- remove_member: as before, and every open invite code of the team is revoked: the removed
-- member may know them (managers see all codes; a player knows the one they joined with), and a
-- code works for any account. The managers create new codes for people who haven't joined yet.
create or replace function public.remove_member(p_team_id text, p_user_id uuid)
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
  if not exists (select 1 from public.team_members m
                 where m.team_id = p_team_id and m.user_id <> p_user_id) then
    raise exception 'last_member' using errcode = 'VL004';
  end if;
  delete from public.team_members where team_id = p_team_id and user_id = p_user_id;
  if found then
    insert into private.team_removals (team_id, user_id, removed_at)
    values (p_team_id, p_user_id, now())
    on conflict (team_id, user_id) do update set removed_at = excluded.removed_at;
    update public.invites i set revoked_at = now()
    where i.team_id = p_team_id and i.revoked_at is null and i.expires_at > now();
  end if;
end $$;

-- create_invite: as before, under the team's row lock (like every member change), with the role
-- checked again once the lock is held: a manager who is being made a player or removed at the
-- same moment can't create a code that survives it.
create or replace function public.create_invite(p_team_id text, p_role text, p_days integer default 7)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites%rowtype;
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('manager', 'player') or p_days is null
     or p_days not between 1 and (case when p_role = 'manager' then 7 else 30 end) then
    raise exception 'bad_invite' using errcode = '22023';
  end if;
  perform 1 from public.teams t where t.id = p_team_id for update; -- serialize with member changes
  if not private.is_team_manager(p_team_id) then -- changed while waiting for the lock
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.invites i
      where i.team_id = p_team_id and i.revoked_at is null and i.expires_at > now()
        and (i.max_uses is null or i.uses < i.max_uses)) >= 20 then
    raise exception 'too_many_invites' using errcode = 'VL007';
  end if;

  for attempt in 1..5 loop
    begin
      insert into public.invites (team_id, code, role, created_by, expires_at, max_uses)
      values (p_team_id, private.new_invite_code(), p_role, (select auth.uid()),
              now() + make_interval(days => p_days),
              case when p_role = 'manager' then 1 end)
      returning * into v_invite;
      return jsonb_build_object('id', v_invite.id, 'code', v_invite.code,
                                'role', v_invite.role, 'expires_at', v_invite.expires_at,
                                'max_uses', v_invite.max_uses);
    exception when unique_violation then
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;
  return null; -- not reached
end $$;

-- join_team: as before, but the team row is locked first and the invite second. A removal or a
-- demotion holds the team row while it revokes codes; with the invite locked first, a join at
-- the same moment could deadlock with it (one of the two would fail with 40P01). In this order
-- the join waits and then finds the code revoked (VL002).
create or replace function public.join_team(p_code text, p_display_name text)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_name text := left(btrim(coalesce(p_display_name, '')), 60);
  v_team_id text;
  v_invite public.invites%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select i.team_id into v_team_id from public.invites i where i.code = v_code;
  if v_team_id is not null then
    perform 1 from public.teams t where t.id = v_team_id for update; -- serialize member changes
  end if;
  -- FOR UPDATE: two people can't both use the last use of a single-use code.
  select * into v_invite from public.invites i
  where i.code = v_code and i.revoked_at is null and i.expires_at > now()
  for update;
  if not found
     or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses)
     or exists (select 1 from private.team_removals r
                where r.team_id = v_invite.team_id and r.user_id = v_uid
                  and r.removed_at >= v_invite.created_at) then
    raise exception 'invite_invalid' using errcode = 'VL002';
  end if;

  insert into public.team_members as m (team_id, user_id, role, display_name)
  values (v_invite.team_id, v_uid, v_invite.role, v_name)
  on conflict (team_id, user_id) do update
    set role = case when excluded.role = 'manager' then 'manager' else m.role end,
        display_name = case when excluded.display_name <> '' then excluded.display_name
                            else m.display_name end
  returning m.role into v_role;

  update public.invites set uses = uses + 1 where id = v_invite.id;
  delete from private.team_removals r where r.team_id = v_invite.team_id and r.user_id = v_uid;
  return jsonb_build_object('team_id', v_invite.team_id, 'role', v_role);
end $$;

-- `create or replace` keeps the owner and the grants; stated again so the file stands alone.
revoke all on function public.set_member_role(text, uuid, text), public.remove_member(text, uuid),
  public.create_invite(text, text, integer), public.join_team(text, text) from public, anon;
grant execute on function public.set_member_role(text, uuid, text),
  public.remove_member(text, uuid), public.create_invite(text, text, integer),
  public.join_team(text, text) to authenticated;
