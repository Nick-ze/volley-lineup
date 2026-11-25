-- v10.0 — synced team records (see docs/SUPABASE.md).
--
-- One row per record: (team, kind, id). Managers write through push_records (last write wins by
-- the clamped client save time, tie-break device id); members read through pull_changes, which
-- pages by a server sequence (`version`). Deletions are tombstones (deleted = true, payload null).
--
-- Pull cursor guarantee: a row's `updated_at` is taken right after its `version`, and every write
-- runs as `authenticated`, whose statement_timeout is 8 s on Supabase. So a version that is not
-- yet committed belongs to a row whose updated_at is less than 8 s old, and a client that only
-- advances its cursor past rows older than server_now − 10 s never skips one. Self-hosted
-- projects must keep `alter role authenticated set statement_timeout = '8s'` (or shorter).
--
-- Timestamps in results are ISO strings with millisecond precision ('2026-01-01T10:00:00.000Z'),
-- like JavaScript's toISOString, and client times are stored truncated to milliseconds, so the
-- `at` a client gets back is exactly the one it sent (unless clamped).

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
  -- A tombstone has no payload; a live record has an object payload of at most 64 kB.
  constraint team_records_payload_ok check (
    (deleted and payload is null)
    or (not deleted and payload is not null and jsonb_typeof(payload) = 'object'
        and octet_length(payload::text) <= 65536)),
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

-- ISO 8601 UTC with milliseconds, the format of JavaScript's Date.toISOString().
create function private.iso_ms(p_ts timestamptz) returns text
  language sql stable set search_path = '' as $$
  select to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;
revoke all on function private.iso_ms(timestamptz) from public, anon;
grant execute on function private.iso_ms(timestamptz) to authenticated; -- pull_changes (invoker)

-- Every write gets a fresh server version and, right after it, the write time (clock time, not
-- the transaction start: see the cursor note above). The client time is truncated to milliseconds
-- and clamped to at most one minute ahead of the server, so a fast clock can't win every
-- conflict. BEFORE INSERT runs before the ON CONFLICT check, so `excluded` in push_records
-- already holds the clamped time.
create function private.stamp_team_record() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.version := nextval('public.team_records_version_seq');
  new.updated_at := clock_timestamp();
  new.client_updated_at := least(date_trunc('milliseconds', new.client_updated_at),
                                 date_trunc('milliseconds', now()) + interval '1 minute');
  return new;
end $$;
revoke all on function private.stamp_team_record() from public, anon, authenticated;

create trigger team_records_stamp
  before insert or update on public.team_records
  for each row execute function private.stamp_team_record();

-- Storage budget: teams.payload_bytes is the sum of the team's payload sizes. A write that grows
-- it past 20 MB is VL007 (team_full); shrinking writes always pass. With at most 10 created teams
-- per user this caps what one account can store.
create function private.count_team_payload() returns trigger
  language plpgsql set search_path = '' as $$
declare
  v_delta bigint := coalesce(octet_length(new.payload::text), 0)
                    - case when tg_op = 'UPDATE' then coalesce(octet_length(old.payload::text), 0)
                           else 0 end;
  v_total bigint;
begin
  if v_delta = 0 then
    return null;
  end if;
  update public.teams t set payload_bytes = t.payload_bytes + v_delta
  where t.id = new.team_id
  returning t.payload_bytes into v_total;
  if v_delta > 0 and v_total > 20 * 1024 * 1024 then
    raise exception 'team_full' using errcode = 'VL007', detail = 'payload bytes';
  end if;
  return null;
end $$;
revoke all on function private.count_team_payload() from public, anon, authenticated;

create trigger team_records_count_payload
  after insert or update on public.team_records
  for each row execute function private.count_team_payload();

-- push_records: managers upload a batch of at most 200 records / 1 MB (else 22023), as a JSON
-- array of {kind, id, at, payload?, deleted?}. A record is written only when its (at, device) is
-- newer than the stored one. Returns one result per item, in order:
--   {kind, id, applied, version, at, updated_at, deleted, device_id, payload (only when not
--    applied)}.
-- A team holds at most 20 000 records and 20 MB of payloads (VL007).
-- No function-level statement_timeout: it wouldn't shorten the running statement; the
-- `authenticated` role's 8 s limit applies (see the cursor note at the top).
create function public.push_records(p_team_id text, p_device_id text, p_records jsonb)
  returns jsonb
  language plpgsql security definer set search_path = '' as $$
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
       or coalesce(jsonb_typeof(v_item -> 'deleted'), 'boolean') <> 'boolean' then
      raise exception 'bad_batch' using errcode = '22023';
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

  select count(*) into v_count from public.team_records r where r.team_id = p_team_id;
  if v_count > 20000 - 200 then
    select v_count + count(*) into v_count
    from jsonb_array_elements(p_records) e
    where not exists (select 1 from public.team_records r
                      where r.team_id = p_team_id and r.kind = e.value ->> 'kind'
                        and r.id = e.value ->> 'id');
    if v_count > 20000 then
      raise exception 'team_full' using errcode = 'VL007', detail = 'records';
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
        'at', private.iso_ms(v_row.client_updated_at),
        'updated_at', private.iso_ms(v_row.updated_at),
        'deleted', v_row.deleted, 'device_id', v_row.device_id)
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
    'server_now', private.iso_ms(now()), -- transaction start: never after the read snapshot
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', r.kind, 'id', r.id, 'payload', r.payload, 'deleted', r.deleted,
               'at', private.iso_ms(r.client_updated_at),
               'updated_at', private.iso_ms(r.updated_at), 'version', r.version,
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
