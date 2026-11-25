-- v10.0 — invite codes (see docs/SUPABASE.md).
--
-- A manager creates a code for a role; anyone signed in who knows an unexpired, unrevoked code
-- joins the team with that role. Codes are 10 characters from a 32-letter alphabet (50 bits),
-- shown as "ABCDE-FGHJK". Only managers can list a team's invites.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  role text not null check (role in ('manager', 'player')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  uses integer not null default 0,
  check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
create index invites_team_id_idx on public.invites (team_id);
create index invites_created_by_idx on public.invites (created_by);

alter table public.invites enable row level security;
revoke all on public.invites from public, anon, authenticated;
grant select on public.invites to authenticated;

-- Managers see their teams' invites; players and strangers see none.
create policy invites_select_managers on public.invites
  for select to authenticated
  using (team_id in (select private.my_managed_team_ids()));

-- A random code: each of 10 random bytes picks one of 32 letters (256 is a multiple of 32, so
-- every letter is equally likely). No I, O, 0 or 1.
create function private.new_invite_code() returns text
  language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(10);
  v_code text := '';
begin
  for i in 0..9 loop
    v_code := v_code || substr(v_alphabet, get_byte(v_bytes, i) % 32 + 1, 1);
  end loop;
  return v_code;
end $$;
revoke all on function private.new_invite_code() from public, anon, authenticated;

-- create_invite: managers create a code for `p_role`, valid 1–30 days (else 22023). At most 20
-- active invites per team (VL007). Returns {id, code, role, expires_at}.
create function public.create_invite(p_team_id text, p_role text, p_days integer default 7)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites%rowtype;
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('manager', 'player')
     or p_days is null or p_days not between 1 and 30 then
    raise exception 'bad_invite' using errcode = '22023';
  end if;
  if (select count(*) from public.invites i
      where i.team_id = p_team_id and i.revoked_at is null and i.expires_at > now()) >= 20 then
    raise exception 'too_many_invites' using errcode = 'VL007';
  end if;

  for attempt in 1..5 loop
    begin
      insert into public.invites (team_id, code, role, created_by, expires_at)
      values (p_team_id, private.new_invite_code(), p_role, (select auth.uid()),
              now() + make_interval(days => p_days))
      returning * into v_invite;
      return jsonb_build_object('id', v_invite.id, 'code', v_invite.code,
                                'role', v_invite.role, 'expires_at', v_invite.expires_at);
    exception when unique_violation then
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;
  return null; -- not reached
end $$;

-- revoke_invite: a manager of the invite's team revokes it (idempotent). Unknown invites and
-- other teams' invites are 42501.
create function public.revoke_invite(p_invite_id uuid)
  returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_team_id text;
begin
  select i.team_id into v_team_id from public.invites i where i.id = p_invite_id;
  if v_team_id is null or not private.is_team_manager(v_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.invites set revoked_at = now()
  where id = p_invite_id and revoked_at is null;
end $$;

-- join_team: join with a code (spaces, dashes and case are ignored). An unknown, expired or
-- revoked code is VL002. A code never downgrades: a manager using a player code stays manager.
-- Returns {team_id, role} with the caller's role after joining.
create function public.join_team(p_code text, p_display_name text)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_name text := left(btrim(coalesce(p_display_name, '')), 60);
  v_invite public.invites%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_invite from public.invites i
  where i.code = v_code and i.revoked_at is null and i.expires_at > now();
  if not found then
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
  return jsonb_build_object('team_id', v_invite.team_id, 'role', v_role);
end $$;

revoke all on function public.create_invite(text, text, integer), public.revoke_invite(uuid),
  public.join_team(text, text) from public, anon;
grant execute on function public.create_invite(text, text, integer), public.revoke_invite(uuid),
  public.join_team(text, text) to authenticated;
