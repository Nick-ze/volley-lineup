-- v10.0 — synced team records (see docs/SUPABASE.md).
--
-- One row per record: (team, kind, id). Managers write through push_records (last write wins by
-- the clamped client save time, tie-break device id); members read through pull_changes, which
-- pages by a server sequence (`version`). Deletions are tombstones (deleted = true, payload null).

create sequence public.team_records_version_seq as bigint;
revoke all on sequence public.team_records_version_seq from public, anon, authenticated;

create table public.team_records (
  team_id text not null references public.teams (id) on delete cascade,
  kind text not null
    check (kind in ('team', 'player', 'season', 'opponent', 'match', 'set', 'preset', 'starters')),
  id text not null check (char_length(id) between 1 and 200),
  payload jsonb,
  deleted boolean not null default false,
  client_updated_at timestamptz not null,           -- clamped client save time (the LWW key)
  updated_at timestamptz not null default now(),    -- server write time (pull cursor overlap)
  version bigint not null default nextval('public.team_records_version_seq'),
  updated_by uuid references auth.users (id) on delete set null,
  device_id text not null default '' check (char_length(device_id) <= 64),
  primary key (team_id, kind, id),
  -- A tombstone has no payload; a live record has an object payload of at most 100 kB.
  constraint team_records_payload_ok check (
    (deleted and payload is null)
    or (not deleted and payload is not null and jsonb_typeof(payload) = 'object'
        and octet_length(payload::text) <= 100000)),
  -- 'team' and 'starters' are one record per team, keyed by the team id.
  constraint team_records_singletons check (kind not in ('team', 'starters') or id = team_id)
);
create index team_records_team_version_idx on public.team_records (team_id, version);
create index team_records_updated_by_idx on public.team_records (updated_by);

alter table public.team_records enable row level security;
revoke all on public.team_records from public, anon, authenticated;
grant select on public.team_records to authenticated;

-- Members read their teams' records (pull_changes runs as the caller, so this filters it too).
create policy team_records_select_members on public.team_records
  for select to authenticated
  using (team_id in (select private.my_team_ids()));

-- Every write gets a fresh server version and write time, and the client time is clamped to at
-- most one minute ahead of the server (a fast clock can't win every conflict). BEFORE INSERT runs
-- before the ON CONFLICT check, so `excluded` in push_records already holds the clamped time.
create function private.stamp_team_record() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.version := nextval('public.team_records_version_seq');
  new.client_updated_at := least(new.client_updated_at, now() + interval '1 minute');
  return new;
end $$;
revoke all on function private.stamp_team_record() from public, anon, authenticated;

create trigger team_records_stamp
  before insert or update on public.team_records
  for each row execute function private.stamp_team_record();

-- push_records: managers upload a batch of at most 200 records / 1 MB (else 22023), as a JSON
-- array of {kind, id, at, payload?, deleted?}. A record is written only when its (at, device) is
-- newer than the stored one. Returns one result per item, in order:
--   {kind, id, applied, version, at, updated_at, deleted, payload (only when not applied)}.
-- A team holds at most 20 000 records (VL007).
create function public.push_records(p_team_id text, p_device_id text, p_records jsonb)
  returns jsonb
  language plpgsql security definer set search_path = '' set statement_timeout = '8s' as $$
declare
  v_uid uuid := (select auth.uid());
  v_device text := coalesce(p_device_id, '');
  v_item jsonb;
  v_kind text;
  v_id text;
  v_deleted boolean;
  v_payload jsonb;
  v_at timestamptz;
  v_applied boolean;
  v_row public.team_records%rowtype;
  v_count bigint;
  v_out jsonb := '[]'::jsonb;
begin
  if not private.is_team_manager(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) > 200 or octet_length(p_records::text) > 1048576 then
    raise exception 'bad_batch' using errcode = '22023';
  end if;
  -- Shape check of every item before writing anything.
  for v_item in select e.value from jsonb_array_elements(p_records) e loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'kind') is distinct from 'string'
       or jsonb_typeof(v_item -> 'id') is distinct from 'string'
       or jsonb_typeof(v_item -> 'at') is distinct from 'string'
       or coalesce(jsonb_typeof(v_item -> 'deleted'), 'boolean') <> 'boolean'
       or not pg_input_is_valid(v_item ->> 'at', 'timestamptz') then
      raise exception 'bad_batch' using errcode = '22023';
    end if;
  end loop;

  select count(*) into v_count from public.team_records r where r.team_id = p_team_id;
  if v_count > 20000 - 200 then
    select v_count + count(*) into v_count
    from jsonb_array_elements(p_records) e
    where not exists (select 1 from public.team_records r
                      where r.team_id = p_team_id and r.kind = e.value ->> 'kind'
                        and r.id = e.value ->> 'id');
    if v_count > 20000 then
      raise exception 'team_full' using errcode = 'VL007';
    end if;
  end if;

  for v_item in select e.value from jsonb_array_elements(p_records) e loop
    v_kind := v_item ->> 'kind';
    v_id := v_item ->> 'id';
    v_deleted := coalesce((v_item ->> 'deleted')::boolean, false);
    v_payload := case when v_deleted then null else v_item -> 'payload' end;
    v_at := (v_item ->> 'at')::timestamptz;

    insert into public.team_records as t
      (team_id, kind, id, payload, deleted, client_updated_at, updated_by, device_id)
    values (p_team_id, v_kind, v_id, v_payload, v_deleted, v_at, v_uid, v_device)
    on conflict (team_id, kind, id) do update
      set payload = excluded.payload,
          deleted = excluded.deleted,
          client_updated_at = excluded.client_updated_at,
          updated_by = excluded.updated_by,
          device_id = excluded.device_id
      where (excluded.client_updated_at, excluded.device_id) > (t.client_updated_at, t.device_id)
    returning t.* into v_row;
    v_applied := found;

    if not v_applied then
      select * into v_row from public.team_records r
      where r.team_id = p_team_id and r.kind = v_kind and r.id = v_id;
    end if;

    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'kind', v_row.kind, 'id', v_row.id, 'applied', v_applied, 'version', v_row.version,
        'at', v_row.client_updated_at, 'updated_at', v_row.updated_at, 'deleted', v_row.deleted)
      || case when v_applied then '{}'::jsonb
              else jsonb_build_object('payload', v_row.payload) end);
  end loop;
  return v_out;
end $$;

-- pull_changes: rows of a team with version > p_after, oldest first, at most p_limit (1–1000,
-- default 500). SECURITY INVOKER: RLS returns nothing for non-members. `server_now` lets the
-- client keep a 10 s overlap so a slow concurrent push is never skipped.
create function public.pull_changes(p_team_id text, p_after bigint, p_limit integer default 500)
  returns jsonb
  language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'server_now', now(),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', r.kind, 'id', r.id, 'payload', r.payload, 'deleted', r.deleted,
               'at', r.client_updated_at, 'updated_at', r.updated_at, 'version', r.version,
               'device_id', r.device_id) order by r.version)
      from (select * from public.team_records t
            where t.team_id = p_team_id and t.version > coalesce(p_after, 0)
            order by t.version
            limit least(greatest(coalesce(p_limit, 500), 1), 1000)) r), '[]'::jsonb))
$$;

revoke all on function public.push_records(text, text, jsonb),
  public.pull_changes(text, bigint, integer) from public, anon;
grant execute on function public.push_records(text, text, jsonb),
  public.pull_changes(text, bigint, integer) to authenticated;
