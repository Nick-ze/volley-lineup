-- v10.0 — live match holds (see docs/SUPABASE.md).
--
-- The device that scores a match live holds it for 15 minutes and refreshes the hold while the
-- live screen is open. Other devices show the match read-only; managers can take it over. The
-- hold is advisory: offline scoring is never blocked.

create table public.match_holds (
  team_id text not null references public.teams (id) on delete cascade,
  match_id text not null check (char_length(match_id) between 1 and 200),
  user_id uuid references auth.users (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 1 and 64),
  holder_name text not null default '' check (char_length(holder_name) <= 60),
  held_until timestamptz not null,
  primary key (team_id, match_id)
);
create index match_holds_user_id_idx on public.match_holds (user_id);

alter table public.match_holds enable row level security;
revoke all on public.match_holds from public, anon, authenticated;
grant select on public.match_holds to authenticated;

-- Members see the holds of their teams (so viewers can show "Being scored on …").
create policy match_holds_select_members on public.match_holds
  for select to authenticated
  using (team_id in (select private.my_team_ids()));

-- A member who leaves, is removed or is demoted to player loses their holds in that team.
create function private.drop_member_holds() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.role <> 'manager' then
    delete from public.match_holds h where h.team_id = old.team_id and h.user_id = old.user_id;
  end if;
  return null;
end $$;
revoke all on function private.drop_member_holds() from public, anon, authenticated;

create trigger team_members_drop_holds
  after update of role or delete on public.team_members
  for each row execute function private.drop_member_holds();

-- hold_match: managers claim or refresh the hold for 15 minutes. If another device holds it and
-- the hold hasn't expired, it is granted only with p_take_over. Returns
-- {granted, holder_name, held_until} — the current holder when not granted.
create function public.hold_match(p_team_id text, p_match_id text, p_device_id text,
                                  p_holder_name text, p_take_over boolean default false)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_hold public.match_holds%rowtype;
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- One statement, so two devices claiming at the same moment can't both win.
  insert into public.match_holds as h
    (team_id, match_id, user_id, device_id, holder_name, held_until)
  values (p_team_id, p_match_id, (select auth.uid()), p_device_id,
          left(btrim(coalesce(p_holder_name, '')), 60), now() + interval '15 minutes')
  on conflict (team_id, match_id) do update
    set user_id = excluded.user_id,
        device_id = excluded.device_id,
        holder_name = excluded.holder_name,
        held_until = excluded.held_until
    where coalesce(p_take_over, false)
       or h.device_id = excluded.device_id
       or h.held_until <= now()
  returning h.* into v_hold;

  if found then
    return jsonb_build_object('granted', true, 'holder_name', v_hold.holder_name,
                              'held_until', v_hold.held_until);
  end if;
  select * into v_hold from public.match_holds h
  where h.team_id = p_team_id and h.match_id = p_match_id;
  return jsonb_build_object('granted', false, 'holder_name', v_hold.holder_name,
                            'held_until', v_hold.held_until);
end $$;

-- release_match: managers release their own device's hold (another device's hold stays).
create function public.release_match(p_team_id text, p_match_id text, p_device_id text)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.match_holds h
  where h.team_id = p_team_id and h.match_id = p_match_id and h.device_id = p_device_id;
end $$;

revoke all on function public.hold_match(text, text, text, text, boolean),
  public.release_match(text, text, text) from public, anon;
grant execute on function public.hold_match(text, text, text, text, boolean),
  public.release_match(text, text, text) to authenticated;
