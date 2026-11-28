-- v12.4 — shared hosted tournaments (see docs/SUPABASE.md, "Hosted tournaments").
--
-- Model: a hosted tournament is shared by its host with guests. The host (the account that
-- uploaded it; exactly one, never changed) may write everything. A guest joins with an invite code
-- as `scorer` and may write results only (set scores and live rallies). Everything is separate
-- from the team tables: nothing of v10 is changed, dropped or read here except the helpers
-- `private.new_invite_code()` and `private.iso_ms()`.
--
-- Tables are SELECT-only for `authenticated` (RLS: members only); every write goes through the
-- SECURITY DEFINER RPCs below, which check the caller's role themselves. Nothing is granted to
-- `anon`. Deleting the host's account deletes their tournaments (foreign-key cascade).
--
-- Error codes (SQLSTATE → meaning), the same set as v10:
--   42501 forbidden · VL002 invite_invalid · VL006 too_many_tournaments · VL007 tournament_full
--   22023 bad_batch / bad argument
--
-- Apply after 20261126140000_v10_audit_medium_low.sql.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.tournaments (
  -- The local tournament id is used as is (a UUID from the app).
  id text primary key check (id ~ '^[A-Za-z0-9._~-]{1,100}$' and id !~ '^\.+$'),
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Sum of the tournament's record payload sizes (kept by a trigger; at most 5 MB).
  payload_bytes bigint not null default 0
);
create index tournaments_owner_idx on public.tournaments (owner);

create table public.tournament_members (
  tournament_id text not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('host', 'scorer')),
  display_name text not null default '' check (char_length(display_name) <= 60),
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
create index tournament_members_user_id_idx on public.tournament_members (user_id);

create table public.tournament_invites (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  uses integer not null default 0,
  check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
create index tournament_invites_tournament_id_idx on public.tournament_invites (tournament_id);
create index tournament_invites_created_by_idx on public.tournament_invites (created_by);

create sequence public.tournament_records_version_seq as bigint;
revoke all on sequence public.tournament_records_version_seq from public, anon, authenticated;

-- One row per record: (tournament, kind, id). Last write wins by the clamped client save time
-- (tie-break device id); deletions are tombstones. The same cursor guarantee as team_records:
-- `updated_at` is taken right after `version`, and writers run under the 8 s statement timeout
-- of `authenticated`.
create table public.tournament_records (
  tournament_id text not null references public.tournaments (id) on delete cascade,
  kind text not null check (kind in ('tournament', 'team', 'player', 'result')),
  id text not null check (char_length(id) between 1 and 200),
  payload jsonb,
  deleted boolean not null default false,
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now(),
  version bigint not null default nextval('public.tournament_records_version_seq'),
  updated_by uuid references auth.users (id) on delete set null,
  device_id text not null default '' check (char_length(device_id) <= 64),
  primary key (tournament_id, kind, id),
  constraint tournament_records_payload_ok check (
    (deleted and payload is null)
    or (not deleted and payload is not null and jsonb_typeof(payload) = 'object'
        and octet_length(payload::text) <= 65536)),
  -- The tournament's own record: one per tournament, keyed by its id, never a tombstone (a
  -- tournament is deleted for everyone by delete_tournament).
  constraint tournament_records_singleton check (
    kind <> 'tournament' or (id = tournament_id and not deleted))
);
create index tournament_records_version_idx on public.tournament_records (tournament_id, version);
create index tournament_records_updated_by_idx on public.tournament_records (updated_by);

alter table public.tournaments enable row level security;
alter table public.tournament_members enable row level security;
alter table public.tournament_invites enable row level security;
alter table public.tournament_records enable row level security;
revoke all on public.tournaments, public.tournament_members, public.tournament_invites,
  public.tournament_records from public, anon, authenticated;
grant select on public.tournaments, public.tournament_members, public.tournament_invites,
  public.tournament_records to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so the member policy doesn't recurse into itself)
-- ---------------------------------------------------------------------------------------------

create function private.my_tournament_ids() returns setof text
  language sql stable security definer set search_path = '' as $$
  select m.tournament_id from public.tournament_members m where m.user_id = (select auth.uid())
$$;

create function private.my_hosted_tournament_ids() returns setof text
  language sql stable security definer set search_path = '' as $$
  select m.tournament_id from public.tournament_members m
  where m.user_id = (select auth.uid()) and m.role = 'host'
$$;

-- The caller's role in a tournament: 'host', 'scorer' or null (not a member).
create function private.tournament_role(p_tournament_id text) returns text
  language sql stable security definer set search_path = '' as $$
  select m.role from public.tournament_members m
  where m.tournament_id = p_tournament_id and m.user_id = (select auth.uid())
$$;

revoke all on function private.my_tournament_ids(), private.my_hosted_tournament_ids(),
  private.tournament_role(text) from public, anon;
grant execute on function private.my_tournament_ids(), private.my_hosted_tournament_ids(),
  private.tournament_role(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Policies: members read their tournaments, fellow members and records; only the host reads
-- the invite codes. No insert / update / delete policies: all writes go through the RPCs.
-- ---------------------------------------------------------------------------------------------

create policy tournaments_select_members on public.tournaments
  for select to authenticated
  using (id in (select private.my_tournament_ids()));

create policy tournament_members_select_members on public.tournament_members
  for select to authenticated
  using (tournament_id in (select private.my_tournament_ids()));

create policy tournament_invites_select_host on public.tournament_invites
  for select to authenticated
  using (tournament_id in (select private.my_hosted_tournament_ids()));

create policy tournament_records_select_members on public.tournament_records
  for select to authenticated
  using (tournament_id in (select private.my_tournament_ids()));

-- ---------------------------------------------------------------------------------------------
-- Triggers on tournament_records
-- ---------------------------------------------------------------------------------------------

-- Every write gets a fresh server version and, right after it, the write time. The client time
-- is truncated to milliseconds and clamped to at most one minute ahead of the server.
create function private.stamp_tournament_record() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.version := nextval('public.tournament_records_version_seq');
  new.updated_at := clock_timestamp();
  new.client_updated_at := least(date_trunc('milliseconds', new.client_updated_at),
                                 date_trunc('milliseconds', now()) + interval '1 minute');
  return new;
end $$;
revoke all on function private.stamp_tournament_record() from public, anon, authenticated;

create trigger tournament_records_stamp
  before insert or update on public.tournament_records
  for each row execute function private.stamp_tournament_record();

-- Storage budget: payload sizes plus 512 bytes per row; a write that grows a tournament past
-- 5 MB is VL007. With at most 20 tournaments per host this caps what one account can store.
create function private.count_tournament_payload() returns trigger
  language plpgsql set search_path = '' as $$
declare
  v_delta bigint := coalesce(octet_length(new.payload::text), 0)
                    + case when tg_op = 'INSERT' then 512
                           else -coalesce(octet_length(old.payload::text), 0) end;
  v_total bigint;
begin
  if v_delta = 0 then
    return null;
  end if;
  update public.tournaments t set payload_bytes = t.payload_bytes + v_delta
  where t.id = new.tournament_id
  returning t.payload_bytes into v_total;
  if v_delta > 0 and v_total > 5 * 1024 * 1024 then
    raise exception 'tournament_full' using errcode = 'VL007', detail = 'payload bytes';
  end if;
  return null;
end $$;
revoke all on function private.count_tournament_payload() from public, anon, authenticated;

create trigger tournament_records_count_payload
  after insert or update on public.tournament_records
  for each row execute function private.count_tournament_payload();

-- ---------------------------------------------------------------------------------------------
-- RPCs: tournaments and members
-- ---------------------------------------------------------------------------------------------

-- create_tournament: share a local tournament. Returns 'created' (the caller is now its host),
-- 'member' (the id exists and the caller already belongs to it) or 'taken' (the id belongs to
-- someone else's tournament). A user hosts at most 20 shared tournaments (VL006).
create function public.create_tournament(p_tournament_id text, p_display_name text)
  returns text
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inserted text;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.tournaments t where t.id = p_tournament_id) then
    return case when private.tournament_role(p_tournament_id) is not null then 'member'
                else 'taken' end;
  end if;

  -- One creation at a time per user, so parallel calls can't pass the limit together.
  perform pg_advisory_xact_lock(hashtextextended('vl.create_tournament:' || v_uid::text, 0));
  if (select count(*) from public.tournaments t where t.owner = v_uid) >= 20 then
    raise exception 'too_many_tournaments' using errcode = 'VL006';
  end if;

  insert into public.tournaments (id, owner) values (p_tournament_id, v_uid)
  on conflict (id) do nothing
  returning id into v_inserted;
  if v_inserted is null then -- created concurrently by someone else
    return case when private.tournament_role(p_tournament_id) is not null then 'member'
                else 'taken' end;
  end if;

  insert into public.tournament_members (tournament_id, user_id, role, display_name)
  values (p_tournament_id, v_uid, 'host', left(btrim(coalesce(p_display_name, '')), 60));
  return 'created';
end $$;

-- delete_tournament: "Stop sharing". Host only; the cascade removes members, invites and
-- records for everyone. The role is checked again under the row lock.
create function public.delete_tournament(p_tournament_id text)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if private.tournament_role(p_tournament_id) is distinct from 'host' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.tournaments t where t.id = p_tournament_id for update;
  if private.tournament_role(p_tournament_id) is distinct from 'host' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.tournaments where id = p_tournament_id;
end $$;

-- leave_tournament: a guest leaves. The host can't (42501): they stop sharing instead.
create function public.leave_tournament(p_tournament_id text)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if private.tournament_role(p_tournament_id) is distinct from 'scorer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.tournaments t where t.id = p_tournament_id for update;
  delete from public.tournament_members
  where tournament_id = p_tournament_id and user_id = (select auth.uid()) and role = 'scorer';
end $$;

-- remove_tournament_member: the host removes a guest (never themselves: 22023) and every open
-- invite code of the tournament is revoked, because the removed guest knows one. A missing
-- member is a no-op.
create function public.remove_tournament_member(p_tournament_id text, p_user_id uuid)
  returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if private.tournament_role(p_tournament_id) is distinct from 'host' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = (select auth.uid()) then
    raise exception 'bad_member' using errcode = '22023';
  end if;
  perform 1 from public.tournaments t where t.id = p_tournament_id for update;
  if private.tournament_role(p_tournament_id) is distinct from 'host' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.tournament_members
  where tournament_id = p_tournament_id and user_id = p_user_id and role = 'scorer';
  if found then
    update public.tournament_invites i set revoked_at = now()
    where i.tournament_id = p_tournament_id and i.revoked_at is null and i.expires_at > now();
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- RPCs: invite codes (guests join as scorers; a code works many times until it expires)
-- ---------------------------------------------------------------------------------------------

-- create_tournament_invite: the host creates a code valid 1–30 days (else 22023). At most 20
-- open codes per tournament (VL007). Returns {id, code, expires_at}.
create function public.create_tournament_invite(p_tournament_id text, p_days integer default 7)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.tournament_invites%rowtype;
begin
  if private.tournament_role(p_tournament_id) is distinct from 'host' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 30 then
    raise exception 'bad_invite' using errcode = '22023';
  end if;
  perform 1 from public.tournaments t where t.id = p_tournament_id for update;
  if private.tournament_role(p_tournament_id) is distinct from 'host' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.tournament_invites i
      where i.tournament_id = p_tournament_id and i.revoked_at is null
        and i.expires_at > now()) >= 20 then
    raise exception 'too_many_invites' using errcode = 'VL007';
  end if;

  for attempt in 1..5 loop
    begin
      insert into public.tournament_invites (tournament_id, code, created_by, expires_at)
      values (p_tournament_id, private.new_invite_code(), (select auth.uid()),
              now() + make_interval(days => p_days))
      returning * into v_invite;
      return jsonb_build_object('id', v_invite.id, 'code', v_invite.code,
                                'expires_at', v_invite.expires_at);
    exception when unique_violation then
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;
  return null; -- not reached
end $$;

-- revoke_tournament_invite: the host of the invite's tournament revokes it (idempotent).
-- Unknown invites and other tournaments' invites are 42501.
create function public.revoke_tournament_invite(p_invite_id uuid)
  returns void
  language plpgsql security definer set search_path = '' as $$
declare
  v_tournament_id text;
begin
  select i.tournament_id into v_tournament_id
  from public.tournament_invites i where i.id = p_invite_id;
  if v_tournament_id is null
     or private.tournament_role(v_tournament_id) is distinct from 'host' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.tournament_invites set revoked_at = now()
  where id = p_invite_id and revoked_at is null;
end $$;

-- join_tournament: join with a code (spaces, dashes and case are ignored). VL002 when the code
-- is unknown, expired or revoked. The caller becomes a scorer; a member keeps the role they have
-- (the host stays host). A tournament has at most 50 members (VL007). Returns
-- {tournament_id, role}. The tournament row is locked before the invite, the same order as the
-- removal that revokes codes.
create function public.join_tournament(p_code text, p_display_name text)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_name text := left(btrim(coalesce(p_display_name, '')), 60);
  v_tournament_id text;
  v_invite public.tournament_invites%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select i.tournament_id into v_tournament_id
  from public.tournament_invites i where i.code = v_code;
  if v_tournament_id is not null then
    perform 1 from public.tournaments t where t.id = v_tournament_id for update;
  end if;
  select * into v_invite from public.tournament_invites i
  where i.code = v_code and i.revoked_at is null and i.expires_at > now()
  for update;
  if not found then
    raise exception 'invite_invalid' using errcode = 'VL002';
  end if;
  if not exists (select 1 from public.tournament_members m
                 where m.tournament_id = v_invite.tournament_id and m.user_id = v_uid)
     and (select count(*) from public.tournament_members m
          where m.tournament_id = v_invite.tournament_id) >= 50 then
    raise exception 'tournament_full' using errcode = 'VL007', detail = 'members';
  end if;

  insert into public.tournament_members as m (tournament_id, user_id, role, display_name)
  values (v_invite.tournament_id, v_uid, 'scorer', v_name)
  on conflict (tournament_id, user_id) do update
    set display_name = case when excluded.display_name <> '' then excluded.display_name
                            else m.display_name end
  returning m.role into v_role;

  update public.tournament_invites set uses = uses + 1 where id = v_invite.id;
  return jsonb_build_object('tournament_id', v_invite.tournament_id, 'role', v_role);
end $$;

-- ---------------------------------------------------------------------------------------------
-- RPCs: records
-- ---------------------------------------------------------------------------------------------

-- push_tournament_records: upload a batch of at most 200 records / 1 MB (else 22023), as a JSON
-- array of {kind, id, at, payload?, deleted?}. The host may write every kind; a scorer only
-- 'result' records — a batch with anything else is refused as a whole (42501). A record is
-- written only when its (at, device) is newer than the stored one. Returns one result per
-- item, in order: {kind, id, applied, version, at, updated_at, deleted, device_id,
-- payload (only when not applied)}. A tournament holds at most 2 000 records and 5 MB (VL007).
create function public.push_tournament_records(
  p_tournament_id text, p_device_id text, p_records jsonb)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text := private.tournament_role(p_tournament_id);
  v_device text := coalesce(p_device_id, '');
  v_item jsonb;
  v_kind text;
  v_id text;
  v_deleted boolean;
  v_payload jsonb;
  v_at timestamptz;
  v_applied boolean;
  v_row public.tournament_records%rowtype;
  v_count bigint;
  v_out jsonb := '[]'::jsonb;
begin
  if v_role is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) > 200 or octet_length(p_records::text) > 1048576 then
    raise exception 'bad_batch' using errcode = '22023';
  end if;
  -- Shape and permission check of every item before writing anything.
  for v_item in select e.value from jsonb_array_elements(p_records) e loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'kind') is distinct from 'string'
       or jsonb_typeof(v_item -> 'id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'at') is distinct from 'string'
       or coalesce(jsonb_typeof(v_item -> 'deleted'), 'boolean') <> 'boolean' then
      raise exception 'bad_batch' using errcode = '22023';
    end if;
    if (v_item ->> 'kind') not in ('tournament', 'team', 'player', 'result')
       or ((v_item ->> 'kind') = 'tournament'
           and ((v_item ->> 'id') <> p_tournament_id
                or coalesce((v_item ->> 'deleted')::boolean, false))) then
      raise exception 'bad_batch' using errcode = '22023', detail = 'kind';
    end if;
    if v_role <> 'host' and (v_item ->> 'kind') <> 'result' then
      raise exception 'forbidden' using errcode = '42501', detail = 'scorers write results only';
    end if;
    begin
      v_at := (v_item ->> 'at')::timestamptz;
    exception when others then
      raise exception 'bad_batch' using errcode = '22023', detail = 'invalid at';
    end;
    if not isfinite(v_at) then
      raise exception 'bad_batch' using errcode = '22023', detail = 'invalid at';
    end if;
  end loop;

  select count(*) into v_count
  from public.tournament_records r where r.tournament_id = p_tournament_id;
  if v_count > 2000 - 200 then
    select v_count + count(*) into v_count
    from jsonb_array_elements(p_records) e
    where not exists (select 1 from public.tournament_records r
                      where r.tournament_id = p_tournament_id and r.kind = e.value ->> 'kind'
                        and r.id = e.value ->> 'id');
    if v_count > 2000 then
      raise exception 'tournament_full' using errcode = 'VL007', detail = 'records';
    end if;
  end if;

  for v_item in select e.value from jsonb_array_elements(p_records) e loop
    v_kind := v_item ->> 'kind';
    v_id := v_item ->> 'id';
    v_deleted := coalesce((v_item ->> 'deleted')::boolean, false);
    v_payload := case when v_deleted then null else v_item -> 'payload' end;
    v_at := (v_item ->> 'at')::timestamptz;

    insert into public.tournament_records as t
      (tournament_id, kind, id, payload, deleted, client_updated_at, updated_by, device_id)
    values (p_tournament_id, v_kind, v_id, v_payload, v_deleted, v_at, v_uid, v_device)
    on conflict (tournament_id, kind, id) do update
      set payload = excluded.payload,
          deleted = excluded.deleted,
          client_updated_at = excluded.client_updated_at,
          updated_by = excluded.updated_by,
          device_id = excluded.device_id
      where (excluded.client_updated_at, excluded.device_id) > (t.client_updated_at, t.device_id)
    returning t.* into v_row;
    v_applied := found;

    if not v_applied then
      select * into v_row from public.tournament_records r
      where r.tournament_id = p_tournament_id and r.kind = v_kind and r.id = v_id;
    end if;

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'kind', v_row.kind, 'id', v_row.id, 'applied', v_applied, 'version', v_row.version,
        'at', private.iso_ms(v_row.client_updated_at),
        'updated_at', private.iso_ms(v_row.updated_at),
        'deleted', v_row.deleted, 'device_id', v_row.device_id)
      || case when v_applied then '{}'::jsonb
              else jsonb_build_object('payload', v_row.payload) end);
  end loop;
  return v_out;
end $$;

-- pull_tournament_changes: rows of a tournament with version > p_after, oldest first, at most
-- p_limit (1–1000, default 500). SECURITY INVOKER: RLS returns nothing for non-members.
create function public.pull_tournament_changes(
  p_tournament_id text, p_after bigint, p_limit integer default 500)
  returns jsonb
  language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'server_now', private.iso_ms(now()),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', r.kind, 'id', r.id, 'payload', r.payload, 'deleted', r.deleted,
               'at', private.iso_ms(r.client_updated_at),
               'updated_at', private.iso_ms(r.updated_at), 'version', r.version,
               'device_id', r.device_id) order by r.version)
      from (select * from public.tournament_records t
            where t.tournament_id = p_tournament_id and t.version > coalesce(p_after, 0)
            order by t.version
            limit least(greatest(coalesce(p_limit, 500), 1), 1000)) r), '[]'::jsonb))
$$;

revoke all on function public.create_tournament(text, text), public.delete_tournament(text),
  public.leave_tournament(text), public.remove_tournament_member(text, uuid),
  public.create_tournament_invite(text, integer), public.revoke_tournament_invite(uuid),
  public.join_tournament(text, text), public.push_tournament_records(text, text, jsonb),
  public.pull_tournament_changes(text, bigint, integer) from public, anon;
grant execute on function public.create_tournament(text, text), public.delete_tournament(text),
  public.leave_tournament(text), public.remove_tournament_member(text, uuid),
  public.create_tournament_invite(text, integer), public.revoke_tournament_invite(uuid),
  public.join_tournament(text, text), public.push_tournament_records(text, text, jsonb),
  public.pull_tournament_changes(text, bigint, integer) to authenticated;
