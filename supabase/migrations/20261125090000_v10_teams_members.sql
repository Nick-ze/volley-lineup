-- v10.0 — teams and memberships (see docs/SUPABASE.md).
--
-- Model: a team is shared by its members. Members are `manager` (may write) or `player` (read only).
-- Tables are SELECT-only for `authenticated` (RLS: members only); every write goes through the
-- SECURITY DEFINER RPCs below, which check the caller's role themselves. Nothing is granted to `anon`.
--
-- Error codes (SQLSTATE → meaning):
--   42501 forbidden · VL001 last_manager · VL002 invite_invalid · VL004 last_member
--   VL006 too_many_teams · VL007 team_full · VL008 photos_remain · 22023 bad_batch / bad argument

create extension if not exists pgcrypto with schema extensions;

-- Helpers that RLS policies call live in `private`, which the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated; -- RLS policies call private.* as the querying role

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.teams (
  -- The local team id is used as is. It is also the storage folder name: no '/', no '%', and
  -- not only dots ('.' and '..' are not folder names).
  id text primary key check (id ~ '^[A-Za-z0-9._~-]{1,100}$' and id !~ '^\.+$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Sum of the team's record payload sizes (kept by a trigger on team_records; at most 20 MB).
  payload_bytes bigint not null default 0
);
create index teams_created_by_idx on public.teams (created_by);

create table public.team_members (
  team_id text not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('manager', 'player')),
  display_name text not null default '' check (char_length(display_name) <= 60),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_id_idx on public.team_members (user_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
revoke all on public.teams, public.team_members from public, anon, authenticated;
grant select on public.teams, public.team_members to authenticated;

-- Who was removed from which team, and when: join_team refuses codes created before the removal,
-- so a removed member can't come straight back with the code they joined with.
create table private.team_removals (
  team_id text not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  removed_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_removals_user_id_idx on private.team_removals (user_id);
alter table private.team_removals enable row level security; -- no policies: RPCs only
revoke all on private.team_removals from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------------------------

-- Team ids the caller belongs to / manages. SECURITY DEFINER so the team_members policy can use
-- them without recursing into itself. Policies call them as `team_id in (select …)`, which runs
-- once per statement (initPlan) instead of once per row.
create function private.my_team_ids() returns setof text
  language sql stable security definer set search_path = '' as $$
  select m.team_id from public.team_members m where m.user_id = (select auth.uid())
$$;

create function private.my_managed_team_ids() returns setof text
  language sql stable security definer set search_path = '' as $$
  select m.team_id from public.team_members m
  where m.user_id = (select auth.uid()) and m.role = 'manager'
$$;

-- Single-team checks used inside the RPCs.
create function private.is_team_member(p_team_id text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members m
                 where m.team_id = p_team_id and m.user_id = (select auth.uid()))
$$;

create function private.is_team_manager(p_team_id text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members m
                 where m.team_id = p_team_id and m.user_id = (select auth.uid())
                   and m.role = 'manager')
$$;

-- Number of photos in the team's storage folder 'team-photos/<teamId>/'. SECURITY DEFINER so it
-- counts every object, whoever asks (used by the photo upload policy and the team RPCs).
-- A byte range in the C collation ('<id>/' ≤ name < '<id>0', since '0' follows '/') lets the
-- (bucket_id, name) index find the folder instead of filtering every object in the bucket.
-- The bucket isn't versioned, so archived versions and delete markers aren't filtered out.
create function private.team_photo_count(p_team_id text) returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from storage.objects o
  where o.bucket_id = 'team-photos'
    and o.name collate "C" >= p_team_id || '/'
    and o.name collate "C" < p_team_id || '0'
$$;

revoke all on function private.my_team_ids(), private.my_managed_team_ids(),
  private.is_team_member(text), private.is_team_manager(text),
  private.team_photo_count(text) from public, anon;
grant execute on function private.my_team_ids(), private.my_managed_team_ids(),
  private.is_team_member(text), private.is_team_manager(text),
  private.team_photo_count(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Policies: members read their teams and fellow members. No insert / update / delete policies
-- (and no grants): all writes go through the RPCs below.
-- ---------------------------------------------------------------------------------------------

create policy teams_select_members on public.teams
  for select to authenticated
  using (id in (select private.my_team_ids()));

create policy team_members_select_members on public.team_members
  for select to authenticated
  using (team_id in (select private.my_team_ids()));

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

-- Last-manager guard: the last manager can't be demoted, and can't be removed while other members
-- remain. It locks the team row first, so two managers demoting or removing each other at the
-- same moment are serialized and can't leave the team without a manager. `delete_team` and
-- `delete_my_account` switch it off for their own transaction with
-- set_config('app.bypass_member_guard', 'on', true).
create function private.guard_last_manager() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if current_setting('app.bypass_member_guard', true) = 'on' then
    return coalesce(new, old);
  end if;
  if old.role <> 'manager' then
    return coalesce(new, old);
  end if;
  perform 1 from public.teams t where t.id = old.team_id for update;
  if not exists (select 1 from public.team_members m
                 where m.team_id = old.team_id and m.user_id <> old.user_id
                   and m.role = 'manager')
     and ((tg_op = 'UPDATE' and new.role <> 'manager')
          or (tg_op = 'DELETE' and exists (select 1 from public.team_members m
                                           where m.team_id = old.team_id
                                             and m.user_id <> old.user_id))) then
    raise exception 'last_manager' using errcode = 'VL001';
  end if;
  return coalesce(new, old);
end $$;

create trigger team_members_guard
  before update or delete on public.team_members
  for each row execute function private.guard_last_manager();

-- Safety net: a team left without members is deleted. Reachable only when an auth user is deleted
-- outside `delete_my_account` (e.g. from the dashboard) and was the team's only member.
create function private.drop_empty_team() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if current_setting('app.bypass_member_guard', true) is distinct from 'on'
     and not exists (select 1 from public.team_members m where m.team_id = old.team_id) then
    delete from public.teams where id = old.team_id;
  end if;
  return null;
end $$;

create trigger team_members_drop_empty
  after delete on public.team_members
  for each row execute function private.drop_empty_team();

revoke all on function private.guard_last_manager(), private.drop_empty_team()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER: they write tables the caller has no grants on, after checking the role)
-- ---------------------------------------------------------------------------------------------

-- create_team: upload a local team. Returns 'created' (caller is now its manager), 'member' (the
-- id exists and the caller already belongs to it) or 'taken' (the id belongs to someone else, or
-- photos of an earlier team with this id are still stored: the app re-keys its local team and
-- tries again). A user can have created at most 10 existing teams (VL006).
create function public.create_team(p_team_id text, p_display_name text)
  returns text
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inserted text;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.teams t where t.id = p_team_id) then
    return case when private.is_team_member(p_team_id) then 'member' else 'taken' end;
  end if;
  if private.team_photo_count(p_team_id) > 0 then
    return 'taken';
  end if;

  -- One creation at a time per user, so parallel calls can't pass the limit together.
  perform pg_advisory_xact_lock(hashtextextended('vl.create_team:' || v_uid::text, 0));
  if (select count(*) from public.teams t where t.created_by = v_uid) >= 10 then
    raise exception 'too_many_teams' using errcode = 'VL006';
  end if;

  insert into public.teams (id, created_by) values (p_team_id, v_uid)
  on conflict (id) do nothing
  returning id into v_inserted;
  if v_inserted is null then -- created concurrently by someone else
    return case when private.is_team_member(p_team_id) then 'member' else 'taken' end;
  end if;

  insert into public.team_members (team_id, user_id, role, display_name)
  values (p_team_id, v_uid, 'manager', left(btrim(coalesce(p_display_name, '')), 60));
  return 'created';
end $$;

-- leave_team: the caller leaves. The only member must use delete_team instead (VL004); the last
-- manager of a team with other members gets VL001 from the guard.
create function public.leave_team(p_team_id text)
  returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not private.is_team_member(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.teams t where t.id = p_team_id for update; -- serialize member changes
  if not exists (select 1 from public.team_members m
                 where m.team_id = p_team_id and m.user_id <> v_uid) then
    raise exception 'last_member' using errcode = 'VL004';
  end if;
  delete from public.team_members where team_id = p_team_id and user_id = v_uid;
end $$;

-- set_member_role: managers change any member's role (also their own while another manager
-- remains; the guard stops the last one). A missing member is a no-op.
create function public.set_member_role(p_team_id text, p_user_id uuid, p_role text)
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
  update public.team_members set role = p_role
  where team_id = p_team_id and user_id = p_user_id and role <> p_role;
end $$;

-- remove_member: managers remove a member (the guard protects the last manager) and record the
-- removal, so codes created before it no longer let that user back in. Removing the only member
-- is VL004 (use delete_team). A missing member is a no-op.
create function public.remove_member(p_team_id text, p_user_id uuid)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.teams t where t.id = p_team_id for update; -- serialize member changes
  if not exists (select 1 from public.team_members m
                 where m.team_id = p_team_id and m.user_id <> p_user_id) then
    raise exception 'last_member' using errcode = 'VL004';
  end if;
  delete from public.team_members where team_id = p_team_id and user_id = p_user_id;
  if found then
    insert into private.team_removals (team_id, user_id, removed_at)
    values (p_team_id, p_user_id, now())
    on conflict (team_id, user_id) do update set removed_at = excluded.removed_at;
  end if;
end $$;

-- delete_team: "Delete for everyone". Managers only. The client removes the team's photos
-- through the Storage API first; while any remain this is VL008, so a later team with the same
-- id can never see them. The cascade removes members, records, invites and holds.
create function public.delete_team(p_team_id text)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if private.team_photo_count(p_team_id) > 0 then
    raise exception 'photos_remain' using errcode = 'VL008', detail = p_team_id;
  end if;
  perform set_config('app.bypass_member_guard', 'on', true);
  delete from public.teams where id = p_team_id;
  perform set_config('app.bypass_member_guard', 'off', true);
end $$;

revoke all on function public.create_team(text, text), public.leave_team(text),
  public.set_member_role(text, uuid, text), public.remove_member(text, uuid),
  public.delete_team(text) from public, anon;
grant execute on function public.create_team(text, text), public.leave_team(text),
  public.set_member_role(text, uuid, text), public.remove_member(text, uuid),
  public.delete_team(text) to authenticated;
