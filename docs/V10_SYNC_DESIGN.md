# v10 sync design (accounts and cloud sync with Supabase)

This is the full design for v10.0, written by the plan agent and checked by the orchestrator. `docs/PLAN.md` §44–45 holds
the summary and the acceptance checklist; `docs/DECISIONS.md` #253+ holds the decisions. Where this file and an
amendment below disagree, **the amendment wins**.

## Orchestrator amendments (binding)

1. **Delete account without an Edge Function.** No service-role key anywhere: not in the repo, not in the app, not in a function.
   - The client first calls `account_deletion_check()`. For every team in `delete_teams`, it removes that team's photos through the Storage API, which the manager's delete policy allows. If any removal fails, it stops with "Needs a connection".
   - It then calls the RPC `delete_my_account()`, `security definer set search_path = ''`, executable by `authenticated` only:
     - raises `VL001` with the blocked team ids when the user is the last manager of a team that has other members;
     - otherwise sets `app.bypass_member_guard`, deletes the sole-member teams, and runs `delete from auth.users where id = auth.uid()`. The cascades remove memberships and holds. (Verified on the project: `postgres` has DELETE on `auth.users`.)
   - `delete_account_data(uuid)` and `supabase/functions/delete-account` are dropped.
   - RLS tests T25 / T26 are adapted to cover: `anon` → 42501, blocked → VL001, success → user, memberships and sole teams gone.
2. **Test users.** The live-check script and the QA agent need sign-ins without email, so test users are created by SQL (`auth.users` + `auth.identities`, email `*@example.test`, bcrypt password) and **deleted again** afterwards. Web QA may inject a session obtained by password sign-in. The app itself only offers the email code.
3. **SMTP doesn't block the release.** Until the owner sets up custom SMTP and the email templates (see `docs/SUPABASE.md`), codes only reach members of the Supabase organization. This is a documented owner step, not a release blocker.
4. **Advisors.** After every migration, run `get_advisors` (security + performance). Every remaining WARN must be fixed or listed in `docs/SUPABASE.md` with the reason it is intended (e.g. a SECURITY DEFINER RPC that must run for non-members). The security reviewer decides whether a finding is open.

---

## Plan (from the plan agent)

I checked everything below against the code at `19be775` (v9.2.0). File paths are relative to `/home/user/volley-lineup`.

## 0. Hazard review: what I checked and what I'd change

| Your hazard                                                                       | Verdict after reading the code                                                                                                                  | Design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Team.profileId` is local                                                         | Confirmed. It is used by `selectTeamsForProfile` and the `deleteProfile` cascade, and `buildExport` follows it.                                 | `profileId` is left out of the team record. On apply, the local team's `profileId` is kept; a new team gets `sync.account.profileId`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `resetAll` / `replaceAll` / `deleteTeam` / `deleteProfile` look like mass deletes | Confirmed: all four filter whole collections.                                                                                                   | **Rule: tombstones only come from a record disappearing _while its team still exists locally_.** When a whole team vanishes locally, it is **unlinked on this device** (its meta is dropped) and the server is untouched. "Delete for everyone" is a separate explicit RPC. Import has its own rule (§3.12).                                                                                                                                                                                                                                                                                                                                                                                          |
| Stamping `updatedAt` in actions breaks tests and the golden                       | Confirmed. There are ~25 actions, `toEqual` on entities, and a byte golden.                                                                     | Rejected. I also rejected a pure identity-diff subscriber as the _source of truth_: identity changes on no-op rewrites, description-only edits and photo prunes. **Chosen: state-based detection.** A record is dirty iff `hash(syncPayload(record)) !== base[key].h`. Identity is only a WeakMap memo for the hash. The meta lives in the **main store blob (store v13, `sync` key)**. A separate AsyncStorage key would let meta and records persist non-atomically: after a crash, `base` could say "have server v5" while the records are still old, and the old content would be pushed over newer data. Detection is idempotent, survives restarts, and needs no change to any existing action. |
| Embedded sets → per-set records                                                   | Confirmed. Sets are only inserted or replaced (`setLineup`), never removed except together with their match. `updateMatch` is unused by the UI. | Kinds `match` (metadata without `sets`) and `set` (id `<matchId>/<n>`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Remote data untrusted                                                             | Confirmed. The entity zod schemas exist in `exportFormat.ts` but aren't exported.                                                               | Export the entity schemas (no output change). Validate every row per kind, run the server CHECKs, then a deterministic `repairSlice`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Id hijack / collisions                                                            | Confirmed. Local ids are globally unique per collection, and imports can carry arbitrary team ids (`t1` in the golden).                         | `teams.id` is a text PK (global). Records use PK `(team_id, kind, id)`. Upload conflicts → `'member'` (link) or `'taken'` (rekey the local team, then create). A pulled row whose id belongs to _another local team_ is skipped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Clock skew                                                                        | Agreed.                                                                                                                                         | The server clamps with `least(client_ts, now()+1 min)`. Pulls use a server sequence `version` cursor with a 10 s overlap rule (§3.6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Email OTP                                                                         | Agreed.                                                                                                                                         | Owner dashboard steps in §7.6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Delete account                                                                    | The SQL-only route fails: direct `DELETE` on `storage.objects` is blocked on Supabase (storage protect trigger), and team photos must go.       | **Edge Function `delete-account`** (service role, storage cleanup, `auth.admin.deleteUser`). It calls a SQL function `delete_account_data(uuid)` that only `service_role` may execute.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| url-polyfill                                                                      | RN 0.88's `URL` / `URLSearchParams` are still partial.                                                                                          | Install `react-native-url-polyfill` and import it only from `src/lib/sync/polyfill.native.ts`. Verify on a phone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Extra hazards I found:**

1. **`prunePhotos()` clears every `photoId` whose photo is missing** (`photoStore.ts`). If a pulled player is applied before its photo is downloaded, the prune would clear the id. The manager device would then push "no photo" to everyone. Fix: download photos _before_ applying records, and add a `pendingRemotePhotos` exemption set to the prune.
2. **supabase-js `signOut()` defaults to `scope: 'global'`**, which logs out all of the user's devices. Always call `signOut({ scope: 'local' })`.
3. **Postgres grants `EXECUTE` on new functions to `PUBLIC`** (so to `anon`). Every RPC needs `revoke … from public, anon` and then an explicit `grant … to authenticated`.
4. **Opponents have no `teamId`.** Their team is found through the season. `deleteSeason` cascades to opponents _and matches_, so record scoping and the cascade rules must follow season → opponent / match.
5. **Starters get a fresh id on each device** (`setStarters` → `createId()`). Two devices would produce two starters per team, which `isConsistent` rejects. Make starters a logical singleton record `('starters', teamId)`.
6. **`Match.opponent` duplicates `Opponent.name`.** A concurrent rename plus a match edit leaves them mismatched. `repairSlice` recomputes it.
7. **`isConsistent` invariants can be broken by concurrent offline edits:**
   - two "2026/27" seasons, or two "TV Muster" opponents → `repairSlice` merges them deterministically;
   - duplicate preset names → suffix " (2)";
   - duplicate jersey numbers → can't be repaired without renumbering. They are tolerated, with a roster warning and an export warning.

   The repairs keep the user's own export importable.

8. **Blob writes.** The whole store JSON is rewritten on every change (AUDIT). For shared teams there is about one extra blob write per rally (the push ack writes `base`). Acceptable for 10.0; record it as a known cost. Local-only users pay nothing: detection is skipped when no team is linked.
9. **GitHub turns off scheduled workflows after 60 days without repository activity.** The keepalive run doesn't count as activity, so it needs a note in `docs/SUPABASE.md`.
10. **Web join link.** GitHub Pages already serves `404.html` = `index.html` (`deploy-pages.yml:34`), so `/volley-lineup/join?code=…` works on web.

---

## 1. SQL schema (`supabase/migrations/`)

The SQL files hold the whole schema, so the project can be recreated or self-hosted. Each file states `enable row level security` explicitly, even though the project auto-enables it. Nothing is granted to `anon` except `keepalive`. Error codes:

| SQLSTATE | Meaning        | PostgREST         |
| -------- | -------------- | ----------------- |
| `42501`  | forbidden      | 403               |
| `VL001`  | last_manager   | 400, code in body |
| `VL002`  | invite_invalid | 400               |
| `VL004`  | last_member    | 400               |
| `VL006`  | too_many_teams | 400               |
| `VL007`  | team_full      | 400               |
| `22023`  | bad_batch      | 400               |

### 1.1 `20261126090000_v10_teams_members.sql`

```sql
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;          -- RLS policies call private.* as invoker

create table public.teams (
  id text primary key check (id ~ '^[A-Za-z0-9._~-]{1,100}$'),   -- also a storage folder name: no '/', '%'
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.team_members (
  team_id text not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('manager','player')),
  display_name text not null default '' check (char_length(display_name) <= 60),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_id_idx on public.team_members (user_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
revoke all on public.teams, public.team_members from anon, authenticated;
grant select on public.teams, public.team_members to authenticated;

create function private.is_team_member(p_team_id text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members m
                 where m.team_id = p_team_id and m.user_id = (select auth.uid())) $$;
create function private.is_team_manager(p_team_id text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_members m
                 where m.team_id = p_team_id and m.user_id = (select auth.uid()) and m.role = 'manager') $$;
revoke all on function private.is_team_member(text), private.is_team_manager(text) from public;
grant execute on function private.is_team_member(text), private.is_team_manager(text) to authenticated;

create policy teams_select_members on public.teams for select to authenticated
  using (private.is_team_member(id));
create policy team_members_select_members on public.team_members for select to authenticated
  using (private.is_team_member(team_id));
-- no insert/update/delete policies or grants: all writes go through the RPCs below

-- Last-manager guard: never demote the last manager; never remove them while others remain.
create function private.guard_last_manager() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.bypass_member_guard', true) = 'on' then return coalesce(new, old); end if;
  if old.role = 'manager'
     and not exists (select 1 from public.team_members m where m.team_id = old.team_id
                     and m.user_id <> old.user_id and m.role = 'manager')
     and ((tg_op = 'UPDATE' and new.role <> 'manager')
          or (tg_op = 'DELETE' and exists (select 1 from public.team_members m
                where m.team_id = old.team_id and m.user_id <> old.user_id))) then
    raise exception 'last_manager' using errcode = 'VL001';
  end if;
  return coalesce(new, old);
end $$;
create trigger team_members_guard before update or delete on public.team_members
  for each row execute function private.guard_last_manager();

-- Safety net: a team without members is deleted (only reachable via auth.users cascade).
create function private.drop_empty_team() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.bypass_member_guard', true) is distinct from 'on'
     and not exists (select 1 from public.team_members where team_id = old.team_id) then
    delete from public.teams where id = old.team_id;
  end if;
  return null;
end $$;
create trigger team_members_drop_empty after delete on public.team_members
  for each row execute function private.drop_empty_team();
```

RPCs in the same file. All are `security definer set search_path = ''`, with `revoke all … from public, anon; grant execute … to authenticated`.

| RPC                                                                         | What it does                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_team(p_team_id text, p_display_name text) returns text`             | Rejects a null `auth.uid()` with `42501`. Allows at most 50 managed teams, else `VL006`. Runs `insert into teams … on conflict (id) do nothing`. When nothing was inserted it returns `'member'` or `'taken'`. Otherwise it inserts the caller as `manager` and returns `'created'`. |
| `leave_team(p_team_id text) returns void`                                   | Requires membership. If the caller is the sole member → `VL004` (use `delete_team`). Otherwise deletes the caller's own row; the guard raises `VL001` for the last manager.                                                                                                          |
| `set_member_role(p_team_id text, p_user_id uuid, p_role text) returns void` | Manager only, else `42501`. Runs `update`; the guard covers self-demotion.                                                                                                                                                                                                           |
| `remove_member(p_team_id text, p_user_id uuid) returns void`                | Manager only. Runs `delete`; the guard applies.                                                                                                                                                                                                                                      |
| `delete_team(p_team_id text) returns void`                                  | Manager only. Sets `set_config('app.bypass_member_guard','on',true)` and deletes from `teams`. The cascade removes members, records, invites and holds. Storage objects are removed by the client first (§3.12).                                                                     |

### 1.2 `20261126090100_v10_team_records.sql`

```sql
create sequence public.team_records_version_seq as bigint;
create table public.team_records (
  team_id text not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('team','player','season','opponent','match','set','preset','starters')),
  id text not null check (char_length(id) between 1 and 200),
  payload jsonb,
  deleted boolean not null default false,
  client_updated_at timestamptz not null,          -- clamped save time (LWW key)
  updated_at timestamptz not null default now(),   -- server write time (cursor overlap)
  version bigint not null default nextval('public.team_records_version_seq'),
  updated_by uuid references auth.users (id) on delete set null,
  device_id text not null default '' check (char_length(device_id) <= 64),
  primary key (team_id, kind, id),
  constraint team_records_payload_ok check (
    (deleted and payload is null) or
    (not deleted and jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 100000)),
  constraint team_records_singletons check (kind not in ('team','starters') or id = team_id)
);
create index team_records_team_version_idx on public.team_records (team_id, version);
alter table public.team_records enable row level security;
revoke all on public.team_records from anon, authenticated;
grant select on public.team_records to authenticated;
create policy team_records_select_members on public.team_records for select to authenticated
  using (private.is_team_member(team_id));

create function private.stamp_team_record() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.version := nextval('public.team_records_version_seq');
  new.client_updated_at := least(new.client_updated_at, now() + interval '1 minute');
  return new;
end $$;
create trigger team_records_stamp before insert or update on public.team_records
  for each row execute function private.stamp_team_record();
```

`push_records(p_team_id text, p_device_id text, p_records jsonb) returns jsonb` is `security definer` with `set statement_timeout = '8s'`:

1. Checks the caller is a manager, else `42501`.
2. Checks the batch: it must be an array of at most 200 items and at most 1 MB, else `22023`.
3. Checks the team has fewer than 20 000 records, else `VL007`.
4. For each item `{kind,id,payload?,deleted?,at}` it inserts with `on conflict (team_id,kind,id) do update set payload, deleted, client_updated_at, updated_by, device_id … where (excluded.client_updated_at, excluded.device_id) > (t.client_updated_at, t.device_id)`.
   - `excluded` already holds the clamped time, because BEFORE INSERT triggers run before the conflict check.
   - `updated_by := auth.uid()` (it can't be forged).
5. It stores `v_applied := found` and re-selects the row when the update was skipped.
6. It returns `[{kind,id,applied,version,at,updated_at,deleted, payload (only when !applied)}]`.

The same device re-pushing the same `at` (a lost response) comes back as "not applied" with identical content. The client sees an identical hash and simply adopts the base, so the retry is idempotent.

`pull_changes(p_team_id text, p_after bigint, p_limit int default 500) returns jsonb` is `security invoker`, so RLS filters it to members:

```sql
select jsonb_build_object('server_now', now(), 'rows', coalesce((
  select jsonb_agg(jsonb_build_object('kind',r.kind,'id',r.id,'payload',r.payload,'deleted',r.deleted,
    'at',r.client_updated_at,'updated_at',r.updated_at,'version',r.version,'device_id',r.device_id) order by r.version)
  from (select * from public.team_records where team_id = p_team_id and version > p_after
        order by version limit least(greatest(coalesce(p_limit,500),1),1000)) r), '[]'::jsonb));
```

### 1.3 `20261126090200_v10_invites.sql`

```sql
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),     -- 32-char alphabet, 50 bits
  role text not null check (role in ('manager','player')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  uses integer not null default 0,
  check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
create index invites_team_id_idx on public.invites (team_id);
alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;
grant select on public.invites to authenticated;
create policy invites_select_managers on public.invites for select to authenticated
  using (private.is_team_manager(team_id));
```

- `private.new_invite_code() returns text` uses `extensions.gen_random_bytes(10)`. Each byte gives `get_byte % 32` into the alphabet `'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`.
- `create_invite(p_team_id text, p_role text, p_days int default 7) returns jsonb {id, code, role, expires_at}`: manager only; days must be 1–30; at most 20 active invites per team. It retries on `unique_violation` up to 5 times.
- `revoke_invite(p_invite_id uuid) returns void`: manager of that invite's team; sets `revoked_at = now()` when it is still null.
- `join_team(p_code text, p_display_name text) returns jsonb {team_id, role}`:
  - requires a signed-in user;
  - normalizes with `upper(regexp_replace(p_code,'[^A-Za-z0-9]','','g'))`;
  - the invite must be unrevoked and unexpired, else `VL002`;
  - runs `insert … on conflict (team_id,user_id) do update set role = case when excluded.role='manager' then 'manager' else team_members.role end` (a code never downgrades a role);
  - increments `uses`.

### 1.4 `20261126090300_v10_match_holds.sql`

```sql
create table public.match_holds (
  team_id text not null references public.teams (id) on delete cascade,
  match_id text not null check (char_length(match_id) between 1 and 200),
  user_id uuid references auth.users (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 1 and 64),
  holder_name text not null default '' check (char_length(holder_name) <= 60),
  held_until timestamptz not null,
  primary key (team_id, match_id)
);
-- RLS on; grant select to authenticated; policy select using (private.is_team_member(team_id)).
```

- `hold_match(p_team_id, p_match_id, p_device_id, p_holder_name, p_take_over boolean default false) returns jsonb {granted, holder_name, held_until}`:
  - manager only;
  - takes a `select … for update` on the existing hold;
  - if another device holds it, `held_until > now()` and not take-over → returns `granted:false`;
  - otherwise upserts with `held_until = now() + interval '15 minutes'`.
- `release_match(p_team_id, p_match_id, p_device_id) returns void`: manager only; deletes the row only when `device_id` matches.

### 1.5 `20261126090400_v10_account_deletion.sql`

- `account_deletion_check() returns jsonb {delete_teams: text[], blocked_teams: text[]}` (authenticated, uses `auth.uid()`):
  - `blocked_teams` = teams where the user is the last manager and other members remain;
  - `delete_teams` = teams where the user is the only member.
- `delete_account_data(p_user uuid) returns text[]`: `revoke … from public, anon, authenticated; grant execute … to service_role`.
  1. If any team is blocked → `raise 'last_manager' using errcode='VL001', detail = array_to_string(blocked, ',')`.
  2. Set `app.bypass_member_guard = 'on'`.
  3. Delete the sole-member teams.
  4. Delete the user's remaining memberships and holds.
  5. Return the deleted team ids, so the edge function can clean their storage folders.

### 1.6 `20261126090500_v10_storage_team_photos.sql`

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-photos', 'team-photos', false, 262144, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
-- object name: '<teamId>/<photoId>'  (photos are immutable: a new picture = a new photoId)
create policy team_photos_select_members on storage.objects for select to authenticated
  using (bucket_id = 'team-photos' and private.is_team_member((storage.foldername(name))[1]));
create policy team_photos_insert_managers on storage.objects for insert to authenticated
  with check (bucket_id = 'team-photos' and array_length(storage.foldername(name), 1) = 1
              and private.is_team_manager((storage.foldername(name))[1]));
create policy team_photos_delete_managers on storage.objects for delete to authenticated
  using (bucket_id = 'team-photos' and private.is_team_manager((storage.foldername(name))[1]));
-- no UPDATE policy: objects are immutable
```

### 1.7 `20261126090600_v10_keepalive.sql`

```sql
create table public.keepalive (id smallint primary key check (id = 1), note text not null default 'ok');
insert into public.keepalive (id) values (1) on conflict do nothing;
alter table public.keepalive enable row level security;
revoke all on public.keepalive from anon, authenticated;
grant select on public.keepalive to anon;   -- justified: unauthenticated keep-alive read, no data
create policy keepalive_select_anyone on public.keepalive for select to anon using (true);
```

**Realtime is not used in 10.0.** There is no publication change. Watching a live match uses a 15 s poll instead (§3.8).

### 1.8 Other backend files

**`supabase/functions/delete-account/index.ts`** (Deno):

1. Handles CORS / OPTIONS.
2. Reads the `Authorization` bearer and verifies it with `admin.auth.getUser(jwt)`. The admin client is built from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; check at deploy whether the project exposes the key as `SUPABASE_SECRET_KEYS` instead.
3. Calls `rpc('delete_account_data', {p_user})`. `VL001` → 409 `{error:'last_manager', teams}`.
4. For each deleted team: `storage.from('team-photos').list(teamId)` then `remove(...)`.
5. Calls `auth.admin.deleteUser(uid)` and returns 200.

**`supabase/config.toml`**: project id, `[functions.delete-account] verify_jwt = false` (the function verifies itself, which works with the new JWT signing keys), and the auth email OTP settings for self-hosting. The app invokes the function with `region: 'eu-central-2'`.

**`.github/workflows/supabase-keepalive.yml`**:

- `on: schedule: cron '17 5 */3 * *'` and `workflow_dispatch`.
- One step runs `curl -fsS --max-time 30 "$URL/rest/v1/keepalive?select=id&limit=1" -H "apikey: $KEY"`, then `jq -e 'length == 1'`.
- `URL` and `KEY` are read with `jq` from `supabase/public-config.json`, the single source the app also uses.
- `-f` plus `jq -e` make the run fail loudly.

---

## 2. RLS test plan: `supabase/tests/rls.sql`

The script runs via the MCP `execute_sql` connection as `postgres`. Everything is wrapped in `begin; … rollback;`. Plain plpgsql `assert` / `raise` are used, so pgTAP isn't needed.

**Setup (as postgres):**

- Insert four `auth.users`: `MA` (manager of A), `MB` (manager of B), `PA` (player of A), `S` (stranger). Use fixed UUIDs and `aud/role='authenticated'`.
- Switch identity with `reset role; select set_config('request.jwt.claims','{"sub":"<uuid>","role":"authenticated"}', true); set local role authenticated;`.
- Pass values between identities (invite codes) with `set_config('test.code_player', …, false)`, which is rolled back with the transaction.
- A forbidden call is written as `begin perform …; raise exception 'FAIL Tn'; exception when insufficient_privilege then null; end;`. The `FAIL` (P0001) is not caught by that handler, so it surfaces.

| #   | Case                                                                                                                    | Expect                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| T1  | MA `create_team('team-a')`, MB `create_team('team-b')`                                                                  | `'created'`; each reads their own `teams` row                        |
| T2  | MA `push_records('team-a', …)` with team, player, set rows                                                              | all applied; MA reads 3 rows; versions increase                      |
| T3  | MA `create_invite('team-a','player',7)`; PA `join_team(code)`                                                           | `{team_id:'team-a', role:'player'}`                                  |
| T4  | S reads `teams`, `team_members`, `team_records`, `invites`, `match_holds` and `pull_changes('team-a',0)` for A          | 0 rows each, empty `rows`                                            |
| T5  | S `push_records('team-a')`, `create_invite('team-a')`, `delete_team('team-a')`, `hold_match('team-a',…)`                | 42501                                                                |
| T6  | S `create_team('team-a')` (hijack)                                                                                      | `'taken'`; S still has no membership and reads 0 rows                |
| T7  | PA reads A's records / members                                                                                          | n rows; **invites: 0 rows**                                          |
| T8  | PA `push_records`, `create_invite`, `set_member_role`, `remove_member(MA)`, `hold_match`, `delete_team` on A            | 42501                                                                |
| T9  | PA direct `insert/update/delete` on `team_records`, `team_members`, `teams`                                             | 42501 (no grant)                                                     |
| T10 | MA `push_records('team-b')`, reads B, `create_invite('team-b')`, `remove_member('team-b', MB)`, `delete_team('team-b')` | 42501, or 0 rows for reads                                           |
| T11 | Storage: PA `insert into storage.objects(bucket_id,name) values ('team-photos','team-a/x')`                             | 42501                                                                |
| T12 | Storage: MA inserts `team-a/x` (ok), `team-b/y` (42501), `team-a/sub/z` (42501, depth)                                  | as stated                                                            |
| T13 | Storage select: PA sees `team-a/x`; S and MB see 0 rows                                                                 | as stated                                                            |
| T14 | LWW: MA pushes player `p1` with an _older_ `at`                                                                         | `applied=false`, payload unchanged, server row returned              |
| T15 | Clamp: push with `at = now()+1 day`                                                                                     | stored `client_updated_at <= now()+1 min`                            |
| T16 | Tombstone: push `{deleted:true}`                                                                                        | row kept with `payload is null`; a pull returns it                   |
| T17 | CHECKs: unknown kind, 200 KB payload, `kind='team'` with `id≠team_id`, batch of 201                                     | rejected (23514 / 22023)                                             |
| T18 | Last manager: MA `set_member_role(MA,'player')`, `leave_team`, `remove_member(MA)` while PA is a member                 | VL001                                                                |
| T19 | MA promotes PA to manager, then MA leaves                                                                               | ok; MA now reads 0 rows of A (**removed member loses access**)       |
| T20 | PA (now manager) removes MB-who-joined-A (setup: MB joins with a player code)                                           | MB reads 0 rows of A, storage too                                    |
| T21 | Expired invite (as postgres set `expires_at = now()-1s`), revoked invite                                                | VL002                                                                |
| T22 | A manager-role code used by an existing player                                                                          | upgraded to manager; a player code used by a manager → stays manager |
| T23 | Sole member `leave_team`                                                                                                | VL004                                                                |
| T24 | Holds: MA holds match m1 (dev1); MA2 (second manager) `hold_match(dev2)`                                                | `granted:false`; with `p_take_over` → `granted:true`                 |
| T25 | `delete_account_data` called as authenticated                                                                           | 42501 (no execute)                                                   |
| T26 | `account_deletion_check()` as MA: A has other members, B is a sole team                                                 | blocked = {team-a}, delete = {team-b}                                |
| T27 | MA `delete_team('team-a')`                                                                                              | team, members, records, invites, holds gone; guard not triggered     |
| T28 | anon: select `keepalive` → 1 row; insert into keepalive → 42501; select `teams` → 42501                                 | as stated                                                            |
| T29 | anon: `rpc join_team` / `push_records`                                                                                  | 42501 (EXECUTE revoked from public/anon)                             |

Also run `get_advisors(security)` after applying. It must show no RLS or function search-path warnings.

---

## 3. Sync algorithm

### 3.1 Record kinds and payloads

The payload is the canonical object that gets hashed and pushed.

| kind       | id                      | payload = entity minus                            | team scope    |
| ---------- | ----------------------- | ------------------------------------------------- | ------------- |
| `team`     | teamId                  | `id`, **`profileId`**                             | itself        |
| `player`   | player.id               | `id`, `teamId`, **`description`**                 | `teamId`      |
| `season`   | id                      | `id`, `teamId`                                    | `teamId`      |
| `opponent` | id                      | `id` (keeps `seasonId`)                           | season's team |
| `match`    | id                      | `id`, `teamId`, **`sets`**                        | `teamId`      |
| `set`      | `<matchId>/<n>`         | whole `SetLineup` (`setNumber` must equal `n`)    | match's team  |
| `preset`   | id (kind 'preset' only) | `id`, `teamId`                                    | `teamId`      |
| `starters` | teamId (singleton)      | lineup fields + `presetId` + `name` + `createdAt` | `teamId`      |

**Hash:** `stableStringify` (sorted keys, `undefined` dropped), then cyrb53 → 14-hex string. It is memoized per entity object in a WeakMap.

**Payload zod schemas:** derived from the exported `exportFormat` entity schemas (`.omit(...)`) plus a row schema.

### 3.2 Local metadata (store v13 `sync`, device-only, persisted in the main blob)

```ts
// src/domain/types.ts (v10)
export type TeamRole = 'manager' | 'player';
export interface SyncAccount {
  userId: string;
  email: string;
  profileId: string;
}
export interface SyncBase {
  v: number;
  h: string;
  at: string;
  del?: true;
} // server version, payload hash ('' if deleted), clamped save time
export interface SyncEdit {
  at: string;
  h: string;
} // local save time + hash when stamped ('' = deletion)
export interface SyncedTeam {
  userId: string; // account this team syncs through on this device
  role: TeamRole; // cached; refreshed every cycle; drives view-only offline too
  cursor: number; // highest gap-free server version pulled
  base: Record<string, SyncBase>; // key `${kind}:${id}`
  edits: Record<string, SyncEdit>; // pending local changes
  photos: string[]; // photo ids known to exist in the team's cloud folder
}
export interface SyncData {
  deviceId: string | null;
  account: SyncAccount | null;
  teams: Record<string, SyncedTeam>;
}
```

The runtime state is **not persisted**. It lives in `src/store/syncRuntime.ts`: `status`, `session {userId,email}|null`, `holds: Record<matchId, MatchHold>`, `notices: SyncNotice[]`, `pendingRemotePhotos`.

### 3.3 Change detection (`detectChanges`, pure)

For each linked team where `role==='manager'` (viewer teams are never pushed):

- Build `current = sliceToRecords(teamSlice)`.
- A key whose hash differs from `base[key].h` (or has no base) is **dirty**. Its `edits[key]` is kept if `edits[key].h === hash`; otherwise it gets `{at: now, h: hash}`.
- A key in `base` (not `del`) that is missing from `current` is a **tombstone** with `{at: now unless already stamped, h: ''}`.
- A key whose hash is back to `base.h` (an undo) has its edit removed.
- **A team that is missing locally produces no tombstones.** It is returned as `unlinked` and the engine drops its meta.

The engine runs detection 1.5 s after any store data change (it subscribes to the collections' identities), only while at least one team is linked. The `edits` result is written with the next push ack in **one** `syncTransaction`. When offline it is written on its own.

### 3.4 Push

1. Order: `team`, `season`, `opponent`, `player`, `match`, `set`, `preset`, `starters`.
2. Batches hold at most 100 records and 512 KB.
3. Photos first: any `photoId` referenced by a team or player record that isn't in `meta.photos` is uploaded to `team-photos/<teamId>/<photoId>`. The data URI is decoded to bytes with `contentType`; "already exists" counts as success.
   - If the upload fails, that record is skipped this round.
4. `push_records(teamId, deviceId, batch)` results are handled in one `syncTransaction`:
   - `applied` → `base[key] = {v, h: pushedHash, at}`. The edit is deleted only if `edits[key].h === pushedHash` (the user may have edited again meanwhile).
   - not applied → the returned server row goes through the normal merge (it is newer).
5. Errors:
   - network / 5xx / timeout (15 s AbortController via a custom `fetch`) → `offline`, backoff 10 s → 30 s → 2 min → 5 min;
   - `42501` → refresh memberships; if the user was demoted → `resetToCloud(team)` plus a notice ("You can now only view X; N unsynced changes were undone");
   - other 4xx → `error`. The cycle continues with other teams and never throws to the UI.
6. Photo garbage collection (manager devices only, after a successful push): ids in `meta.photos` that no current record references are removed from storage (best effort) and dropped from the list.

### 3.5 Pull and merge (`mergeRemote`, pure, run inside `syncTransaction` against the _current_ state)

1. `pull_changes(team, cursor, 500)`, looping while it returns 500 rows.
2. Every row goes through `parseRemoteRow`. Invalid rows are skipped and counted in a notice.
3. Rows with `version <= base[key].v` are skipped (own pushes, overlap re-reads).
4. **Download photos** referenced by incoming team and player payloads that are missing locally (`setPhoto`). Failures go into `pendingRemotePhotos`, so the prune leaves the `photoId` alone; they are retried next cycle.
5. Per row, with `L` = local payload and `dirty = hash(L) !== base.h`:
   - **not dirty** → apply the remote (upsert or remove);
   - **dirty** → the remote wins iff `remote.at >= edits[key].at` (timestamps compared at millisecond precision; no edit entry → the remote wins). If local wins, keep local; it is still dirty and is pushed next.
   - Either way, `base[key] = {v, h: remoteHash or '', at, del?}`.
6. **Tombstones of parents** (player, season, opponent, match):
   - **Resurrect** instead of deleting when a local child that references the parent is dirty with `edits.at > tombstone.at`, or — for players — when the player is referenced by a played set's events (#73 mirrored). The parent stays local; its base is the tombstone, so a manager re-pushes it.
   - Otherwise **cascade locally**: season → its opponents, matches and their sets; match → sets. The cascade drops those children's base entries, so no tombstones are pushed for them.
7. Children whose parent is unknown locally and was never pulled are not applied (no base entry), so they can never cause a tombstone.
8. **Foreign id**: a row whose id is used by _another_ local team is skipped and reported.
9. **Local-only fields** are restored when applying: `Team.profileId` (local team's, else `account.profileId`) and `Player.description` (the local one).
10. Then `repairSlice` (§4.1) runs, and the new slice replaces the team's records copy-on-write. Unchanged entities keep identity and order; new ones are appended.
11. **Cursor**: `nextCursor(cursor, rows, serverNow)` = the highest version such that every returned row up to it has `updated_at < serverNow − 10 s`. Rows newer than that are read again next time (idempotent via step 3).

- Why it is safe: the sequence value is taken inside a short transaction capped by `statement_timeout = 8s`. A transaction still uncommitted when the reader ran started less than 10 s ago, so the cursor never passes it.

### 3.6 Sync cycle and triggers

`runCycle()` runs under a mutex; a trigger during a running cycle sets `again`.

1. No config, no session, or no linked team for the session user → status `off` (or `synced`).
2. `team_members where user_id = me` → for linked teams of this user:
   - missing → **unlink** (keep the local copy) plus a notice ("You're no longer a member of X" / "X was deleted from the cloud");
   - role changed → update it (demotion → `resetToCloud`).
3. Per team: pull + merge; then `match_holds` for linked teams goes into the runtime `holds`.
4. Detect, push, photo GC.
5. Status `synced` (with `lastSyncedAt`), `offline` (with `retryAt`) or `error`.

Triggers:

- after hydration (`SyncHost` → `startSync()`);
- AppState → `active`; on `background`, a best-effort push;
- a data change → 3 s debounce;
- a 60 s interval in the foreground, or 15 s while `followMatch(matchId)` is active (a live screen of a shared match that this device doesn't hold);
- sign-in, join, upload, download, and "Sync now" (which resets the backoff).

### 3.7 Offline / paused / status

- Fetch `TypeError`, timeout, HTTP ≥ 500 or a paused project → `offline` ("Offline — N changes waiting"). Never an error screen.
- An invalid refresh token (revoked or deleted user) → `error: 'signedOut'` with "Sign in again". Local data is never touched.
- `syncStatus.ts` reducer: phases `off | synced | syncing | offline | error`, plus `pending`, `lastSyncedAt`, `error`, `retryAt`.
- Events: `disabled`, `start`, `done(at)`, `offline(retryAt)`, `failed(code, retryAt)`, `pending(n)`.

### 3.8 Live match hold

- Entering `/match/[id]/live` on a manager device of a shared team calls `holdMatch(teamId, matchId)` (fire-and-forget). It refreshes every 5 min while mounted and calls `releaseMatch` on unmount (best effort). The TTL is 15 min.
- Another device holding it (from the runtime `holds`, `held_until > now`) → the whole match is read-only. Builder and live show "Being scored on Anna's device"; managers get **Take over** (`p_take_over`).
- Viewers always get read-only live plus the 15 s poll, which works as a live ticker.
- **Advisory only.** Offline devices can't claim a hold, and scoring offline always works. If two devices do score the same set concurrently, the later save of the whole set wins. This is documented as a limitation.

### 3.9 First sign-in

1. `verifyCode` succeeds.
2. If `sync.account?.userId` is another user and teams are linked to them: a confirm dialog says those teams stay on the device as local copies (unlinked) and that N unsynced changes won't reach the cloud. Cancel → `signOut({scope:'local'})`.
3. `setSyncAccount({userId, email, profileId: currentProfileId})`.
4. Navigate to `/account/teams?setup=1`:
   - **Upload** lists the current profile's unlinked teams, **unchecked**, with an "Upload selected" button (never upload without asking).
   - **Download** lists cloud memberships not on the device, **checked**.
5. **Upload** per team:
   - if the team id fails the server pattern → `rekeyTeam` first;
   - `create_team` → `'created'` (link with role manager, empty base; detection marks everything dirty; push), `'member'` (link as an _existing_ team: every local record gets `edits.at = 1970-01-01`, so the cloud wins where both have the record and local-only records are still pushed), or `'taken'` (`rekeyTeam(newUUID)`, then create).
6. **Download**: link meta `{role, cursor:0, base:{}}`, then a full pull in one transaction under the linked profile. If the team exists locally (an old unlinked copy), the same epoch-edits rule applies, so the cloud wins.

### 3.10 Sign-out, account switch, Delete all data, delete profile

| Action                                   | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profile → Log out**                    | `signOut({scope:'local'})` and leave the profile (owner's rule). Linked teams and their pending edits stay keyed to `userId`. Managers can keep editing offline and changes sync at the next sign-in of the same account. A confirm dialog appears only when `pending > 0` ("will sync next time you sign in").                                                                                                   |
| **Account switch**                       | Covered in §3.9 step 2.                                                                                                                                                                                                                                                                                                                                                                                           |
| **Delete all data**                      | `signOut(local)`, then `resetAll`, which empties data and sets `sync = {deviceId (kept), account:null, teams:{}}`. Cloud teams are untouched; the confirm text says so.                                                                                                                                                                                                                                           |
| **Delete profile** linked to the account | `signOut(local)`, then `deleteProfile`, which also clears `sync.account`. The cascade removes the teams, so detection unlinks them (no tombstones).                                                                                                                                                                                                                                                               |
| **Delete account**                       | `accountDeletionCheck()` first. If there are blocked teams, list them with links to Members ("Make someone else manager or delete the team"). Otherwise invoke the `delete-account` edge function, then unlink all teams (local copies stay), clear the account and sign out locally. Teams where the user was the only member are deleted from the cloud (warned in the confirm dialog). **Local data is kept.** |

### 3.11 Deleting a synced team (Team list → Delete)

- Manager: **Remove from this device** (local `deleteTeam`, then unlink; the team stays in Account → Cloud teams) or **Delete for everyone**. The latter needs a connection: `removeTeamPhotos(teamId)` → `delete_team` → local `deleteTeam`. Offline → "Needs a connection".
- Player: **Remove from this device** or **Leave team** (`leave_team`, then unlink and remove locally).
- Last manager with other members → leaving fails with `VL001` → "Make someone else manager first".

### 3.12 Import with shared teams (`importWithSharedTeams`, pure)

- Linked teams are **never removed or replaced wholesale** by an import, in either mode. Their owning profile is kept.
- If the file contains a linked team (same id):
  - **manager** → the file's records for it are merged with Merge semantics (file wins per id, nothing deleted) and sync as normal edits;
  - **viewer** → the file's copy is skipped, and the preview notes it.
- Everything else follows Replace / Merge as today.
- So Replace can never mass-tombstone a shared team. The preview shows "Shared teams: … (changes sync to all members)".

### 3.13 Viewers

- Never pushed and never stamped.
- Local repairs may leave a viewer's slice different from `base`. This is harmless: with no edit entry, the remote always wins on the next pull.
- `resetToCloud(team)` (after a demotion) sets cursor 0 and clears edits. A full pull in `cloudWins` mode then drops local records that are absent from the cloud.

---

## 4. Modules and interfaces

### 4.1 Pure domain (`src/domain/`, 100% coverage)

```ts
// syncRecords.ts
export type RecordKind =
  'team' | 'player' | 'season' | 'opponent' | 'match' | 'set' | 'preset' | 'starters';
export interface TeamSlice {
  team: Team;
  players: Player[];
  seasons: Season[];
  opponents: Opponent[];
  matches: Match[];
  presets: LineupPreset[];
}
export type RecordPayload = Readonly<Record<string, unknown>>;
export function recordKey(kind: RecordKind, id: string): string;
export function parseRecordKey(key: string): { kind: RecordKind; id: string } | null;
export function setRecordId(matchId: string, n: SetNumber): string;
export function teamSlice(data: TeamData, teamId: string): TeamSlice | undefined; // TeamData = Pick<AppData-like collections>
export function sliceToRecords(slice: TeamSlice): Map<string, RecordPayload>; // memoized per entity
export function recordsToSlice(
  teamId: string,
  records: ReadonlyMap<string, RecordPayload>,
  local: { profileId: string; descriptions: ReadonlyMap<string, string>; previous?: TeamSlice },
): TeamSlice;
export function replaceTeamSlice<T extends TeamData>(
  data: T,
  teamId: string,
  slice: TeamSlice | undefined,
): T; // copy-on-write, order kept
export function stableStringify(value: unknown): string;
export function payloadHash(payload: RecordPayload): string;
// syncSchema.ts
export interface RemoteRecord {
  kind: RecordKind;
  id: string;
  payload: RecordPayload | null;
  deleted: boolean;
  at: string;
  updatedAt: string;
  version: number;
  deviceId: string;
}
export function parseRemoteRow(row: unknown): RemoteRecord | null; // zod row + per-kind payload, set id/number check
// syncChanges.ts
export interface LocalChange {
  key: string;
  kind: RecordKind;
  id: string;
  payload: RecordPayload | null;
  hash: string;
  at: string;
}
export function detectChanges(
  slice: TeamSlice | undefined,
  team: SyncedTeam,
  now: string,
): { changes: LocalChange[]; edits: SyncedTeam['edits']; unlinked: boolean };
export function pendingCount(sync: SyncData, data: TeamData, userId: string | null): number;
export function pushBatches(
  changes: readonly LocalChange[],
  max?: { count: number; bytes: number },
): LocalChange[][];
export function edgePhotoIds(changes: readonly LocalChange[], known: readonly string[]): string[]; // photos to upload first
// syncMerge.ts
export interface MergeInput {
  slice: TeamSlice | undefined;
  team: SyncedTeam;
  rows: readonly RemoteRecord[];
  local: { profileId: string };
  foreignIds: ReadonlySet<string>;
  mode?: 'lww' | 'cloudWins';
}
export interface MergeOutput {
  slice: TeamSlice | undefined;
  team: SyncedTeam;
  skipped: { key: string; reason: 'foreignId' | 'orphan' | 'invalid' }[];
}
export function mergeRemote(input: MergeInput): MergeOutput;
export interface PushOutcome {
  kind: RecordKind;
  id: string;
  applied: boolean;
  version: number;
  at: string;
  updatedAt: string;
  deleted: boolean;
  payload?: RecordPayload | null;
}
export function applyPushResults(
  team: SyncedTeam,
  pushed: readonly LocalChange[],
  results: readonly PushOutcome[],
): { team: SyncedTeam; stale: RemoteRecord[] };
export function nextCursor(
  cursor: number,
  rows: readonly RemoteRecord[],
  serverNow: string,
  overlapMs?: number,
): number;
export function adoptExisting(slice: TeamSlice): SyncedTeam['edits']; // epoch edits for linking an existing cloud team
// syncRepair.ts
export type RepairIssue =
  | { kind: 'duplicateNumber'; numbers: number[] }
  | { kind: 'renamed'; recordKey: string }
  | { kind: 'merged'; from: string; into: string };
export function repairSlice(slice: TeamSlice): { slice: TeamSlice; issues: RepairIssue[] };
//  - unplayed set / preset / starters refs to missing players → cleared; captain → withValidCaptain
//  - point tags naming a missing player → tag removed (score kept)
//  - match.opponent = opponent.name; match.seasonId = opponent's season
//  - same-name seasons → merge into oldest (createdAt, id): repoint opponents + matches
//  - same-name opponents in a season → merge into oldest: repoint matches
//  - preset name clashes → " (2)"; duplicate jersey numbers → issue only
// syncStatus.ts
export type SyncPhase = 'off' | 'synced' | 'syncing' | 'offline' | 'error';
export interface SyncStatus {
  phase: SyncPhase;
  pending: number;
  lastSyncedAt: string | null;
  error: SyncErrorCode | null;
  retryAt: string | null;
}
export function nextSyncStatus(s: SyncStatus, e: SyncStatusEvent): SyncStatus;
export function backoffMs(attempt: number): number;
// syncAccess.ts (written in the foundation)
export type EditBlock = 'viewer' | 'held' | null;
export function teamAccess(
  sync: SyncData,
  teamId: string,
): { shared: boolean; role: TeamRole | null; canEdit: boolean; block: EditBlock };
export function holdStatus(
  hold: MatchHold | undefined,
  deviceId: string | null,
  now: number,
): 'none' | 'mine' | 'other';
export function matchAccess(
  sync: SyncData,
  teamId: string,
  hold: MatchHold | undefined,
  now: number,
): { canEdit: boolean; block: EditBlock; holder?: string };
// syncImport.ts
export function importWithSharedTeams(
  current: TransferData,
  file: TransferData,
  mode: 'merge' | 'replace',
  shared: readonly { teamId: string; canEdit: boolean }[],
): MergeResult & { skippedTeams?: string[] };
// syncUpload.ts
export function isServerSafeTeamId(id: string): boolean;
export function rekeyTeam<T extends TeamData>(data: T, oldId: string, newId: string): T;
export function setupLists(
  localTeams: readonly Team[],
  linked: SyncData['teams'],
  cloud: readonly CloudTeam[],
): { upload: Team[]; download: CloudTeam[] };
// invites.ts
export function normalizeInviteCode(input: string): string | null; // 10 chars of the alphabet
export function formatInviteCode(code: string): string; // "ABCDE-FGHJK"
export function joinLink(code: string): string; // "volleylineup://join?code=…"
```

**Foundation change to `exportFormat.ts`:** `export` the entity schemas. No behaviour change.

### 4.2 Backend module (`src/lib/sync/`), the only place allowed to import `@supabase/*`

| File                                                         | Contents                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.ts`                                                  | Reads `Constants.expoConfig.extra.supabase {url, publishableKey}`. Missing → `isSyncConfigured() === false`, the account UI is hidden and status is `off`.                                                                                                           |
| `client.ts`                                                  | `createClient(url, key, {auth:{storage: AsyncStorage, autoRefreshToken:true, persistSession:true, detectSessionInUrl:false}, global:{fetch: fetchWithTimeout}})`, plus AppState → `startAutoRefresh` / `stopAutoRefresh`. `polyfill.native.ts` / `polyfill.ts`.      |
| `backend.ts`                                                 | `interface SyncBackend` (memberships, teamNames, createTeam, pushRecords, pullChanges, listHolds, hold/release, upload/download/removePhotos, members, invites, join, leave, deleteTeam, deletionCheck, deleteAccount, auth) and `supabaseBackend` (implementation). |
| `errors.ts`                                                  | `toSyncError(e): SyncErrorCode` = `'offline'                                                                                                                                                                                                                         | 'forbidden' | 'lastManager' | 'lastMember' | 'inviteInvalid' | 'notSignedIn' | 'signedOut' | 'tooMany' | 'unknown'`. |
| `engine.ts`                                                  | `createEngine(backend, clock)`: cycle, scheduler, mutex, backoff, store subscription.                                                                                                                                                                                |
| `photos.ts`, `auth.ts`, `teams.ts`, `members.ts`, `holds.ts` | Thin command wrappers.                                                                                                                                                                                                                                               |
| `database.types.ts`                                          | Generated by worker A.                                                                                                                                                                                                                                               |
| `__mocks__/index.ts`                                         | `jest.fn`s resolving `{ok:true,…}`.                                                                                                                                                                                                                                  |

**Public barrel `src/lib/sync/index.ts`.** Screens and features may import only this:

```ts
type R<T = void> = { ok: true; value: T } | { ok: false; error: SyncErrorCode };
export function isSyncConfigured(): boolean;
export function startSync(): () => void; // SyncHost
export function syncNow(): Promise<void>;
export function followMatch(matchId: string | null): void; // fast poll while watching live
export function requestCode(email: string): Promise<R>;
export function verifyCode(
  email: string,
  code: string,
): Promise<R<{ userId: string; switchedFrom: { email: string; pending: number } | null }>>;
export function linkAccountToProfile(profileId: string): void;
export function signOut(): Promise<void>; // always scope 'local'
export function accountDeletionCheck(): Promise<
  R<{ deleteTeams: string[]; blockedTeams: string[] }>
>;
export function deleteAccount(): Promise<R>;
export function listCloudTeams(): Promise<R<CloudTeam[]>>; // {teamId, name, role, onDevice}
export function uploadTeams(
  teamIds: string[],
): Promise<R<{ teamId: string; result: 'created' | 'linked' | 'rekeyed' | 'failed' }[]>>;
export function downloadTeams(teamIds: string[]): Promise<R>;
export function deleteTeamEverywhere(teamId: string): Promise<R>;
export function leaveTeam(teamId: string): Promise<R>;
export function listMembers(teamId: string): Promise<R<Member[]>>;
export function setMemberRole(teamId: string, userId: string, role: TeamRole): Promise<R>;
export function removeMember(teamId: string, userId: string): Promise<R>;
export function listInvites(teamId: string): Promise<R<Invite[]>>;
export function createInvite(teamId: string, role: TeamRole, days: number): Promise<R<Invite>>;
export function revokeInvite(inviteId: string): Promise<R>;
export function joinTeam(code: string): Promise<R<{ teamId: string; role: TeamRole }>>;
export function holdMatch(
  teamId: string,
  matchId: string,
  takeOver?: boolean,
): Promise<R<{ granted: boolean; holder?: string }>>;
export function releaseMatch(teamId: string, matchId: string): Promise<void>;
```

**ESLint (`eslint.config.js`):**

- Add patterns `@supabase/*` and `@/lib/sync/*` to `no-restricted-imports` for `app/**` and `src/**`.
- Add an override block for `src/lib/sync/**` and tests that re-declares the i18n rule without those patterns.
- Ignore `supabase/functions/**` (Deno) in ESLint, and exclude it in `tsconfig.json`.

### 4.3 Store-side hooks (UI state, no backend import)

- `src/store/syncRuntime.ts`: a non-persisted zustand store.
- `src/store/syncHooks.ts`, re-exported from `@/store`:
  - `useSyncStatus()`, `useSession()`, `useSyncAccount()`, `useSharedTeams()`;
  - `useTeamAccess(teamId)`, `useCanEdit(teamId): boolean`;
  - `useMatchAccess(matchId)` → `{canEdit, block, holder}`;
  - `useSyncNotices()`.

---

## 5. Store v13 / export

- **`AppState.sync: SyncData`** is persisted (added to `partialize`), device-only and not exported.
- `initialState.sync = { deviceId: null, account: null, teams: {} }`. The engine sets `deviceId` (`createId()`) on first start.
- **Migration v12 → v13:** `if (fromVersion < 13 && isRec(state)) state = { sync: { deviceId: null, account: null, teams: {} }, ...state }`. `STORE_VERSION = 13`.
- **Tests:** v12 → v13 adds only `sync`; the v1 → v13 chain; the existing v1 → v11 / v12 tests updated to the new end shape.
- **New actions:**
  - `syncTransaction(fn: (s: AppState) => Partial<AppState>)`: one atomic `set`, used only by the sync engine for records and meta together;
  - `setSyncAccount(account | null)`; `setDeviceId(id)`.
- **Changed actions:**
  - `resetAll` → also `sync = {deviceId kept, account:null, teams:{}}`;
  - `deleteProfile` → clears `sync.account` if linked to that profile;
  - `replaceAll` keeps `sync`, and sets `account = null` when its profile no longer exists (the engine then signs out locally).
- **`photoStore.ts`:** `setPendingRemotePhotos(ids: ReadonlySet<string>)`. `prunePhotos` does not clear `photoId`s in that set.
- **Export:** `selectAppData` and `buildExport` are unchanged. **`schemaVersion` stays 10**, because the file format doesn't change: sync bookkeeping, roles and accounts are device-only, and descriptions and photos are exported as before. The golden stays byte-identical (`UPDATE_GOLDEN` is not run). Add a test: a store with `sync` data exports identically to one without.

---

## 6. Profiles ↔ accounts rules

1. Login is optional. Without it the app behaves exactly like v9.2: no detection runs, no UI is gated, no network.
2. **One account per device at a time**, linked to exactly one local profile (`sync.account.profileId`). Sign-in happens from that profile's Profile tab.
3. Leaving the profile (Log out) signs out of the account (`scope:'local'`). The link and the team meta stay, so signing in again with the same email resumes sync, including pending edits.
4. Shared teams belong to the linked profile (`Team.profileId` is local). Downloads land there; uploads offer only that profile's teams.
5. While signed out:
   - shared teams stay usable offline;
   - managers' edits queue;
   - viewer teams stay read-only (cached role).
6. A different account signing in: the previous account's teams are unlinked (they stay as local copies) after a confirm dialog.
7. Deleting the linked profile, or Delete all data → signed out and teams unlinked. The cloud is untouched.
8. Profile photos never sync. Team and player photos do; descriptions never do.
9. The member `display_name` is the profile name at create or join (≤ 60 characters). Emails are not shown to other members (privacy); your own email shows only on your Account screen.

---

## 7. UI

### 7.1 New routes

All are pre-wired in `app/_layout.tsx` and `parentRoute.ts`.

| Route                         | Screen                                                                                                                                                                                                                                                 | Owner |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `/account`                    | Email, status line + **Sync now**, shared teams with role, "Cloud teams" link, "Join a team", Sign out, Delete account                                                                                                                                 | C     |
| `/account/sign-in` (modal)    | Email → "Send code" → 6-digit field (`textContentType="oneTimeCode"`, `autoComplete="one-time-code"`, numeric), 60 s resend timer, errors (offline / wrong or expired code / rate limit)                                                               | C     |
| `/account/teams` (`?setup=1`) | Upload (unchecked) / Download (checked) pickers                                                                                                                                                                                                        | C     |
| `/team/[teamId]/members`      | **Local team:** "Share this team" (upload). **Shared team:** member list (name, role, "you"); managers get role change, remove, invite list (code, role, expiry, Share / Copy, Revoke) and "New invite" (role + days 1/7/30); everyone gets Leave team | D     |
| `/join?code=`                 | Code field (prefilled from the link), Join. Signed out → "Sign in first" → `/account/sign-in`. No profile → back to `/`                                                                                                                                | D     |

The team screen header gets a "Members" button (D, in `app/team/[teamId]/index.tsx`).

### 7.2 Sync status placement

- `SyncBadge` (cloud icon plus state; tap → `/account`) in the Teams tab header (`ProfileHeader`) and on the team screen for shared teams.
- The full status line on `/account`.
- Team list rows of shared teams show a cloud mark plus "View only" for the player role.
- `SyncNotices` banner on the Teams tab.

### 7.3 View-only treatment

There is one `ReadOnlyNote` component with short reasons: viewer → "Only managers can change this team"; held → "Being scored on Anna's device" plus Take over.

**E1:**

- `src/features/lineup/*` — builder:
  - reuse the existing `locked` path in `LineupBuilder` / `useLineupEditor` with a new reason;
  - `DragProvider disabled`, Bench / `DraggablePlayer`, the `CourtPlayerSpot` / `LiberoSlot` tap alternative;
  - `FormationControls`, `RotateButtons`, `ServeToggle`, `TemplateFill`, `PresetApply`, `CopyClearButtons`, `LiberoReplaces`, `LiberoRoleChips` — all hidden or disabled.
- `src/features/live/*` — read-only scoreboard, court and Performance toggle:
  - hide `PointButtons`, `RallyControls`, `SubPanel`, `UndoActions`, `PointTagRow`, `ErrorTypeChips`, `NextSetSetup` controls, `SetWonPanel` actions, `ResetLiveData`, `FormationConfirm`, `Setup*Row`;
  - hold claim / refresh / release plus `followMatch`.
- `src/features/presets/*` (`PresetsTab` add / rename / delete, `StartersTab` edit, `PresetLineupEditor`), `app/team/[teamId]/preset/[presetId].tsx`, `app/team/[teamId]/starters.tsx`.
- `MatchLinks` stays.
- `LiberoSwapControl` is a view toggle (no store write), so it stays.

**E2:**

- `roster/components/TeamList.tsx`: rename, photo, and the shared-delete dialog.
- `RosterTab.tsx`: Add player, the active toggle, and the duplicate-number warning.
- `PlayerForm.tsx` / `usePlayerForm.ts` and `app/team/[teamId]/player.tsx`: route guard, no Save / Delete / Captain.
- `playerDetail/PlayerHeader.tsx`: Edit hidden.
- `descriptions/DescriptionSection.tsx`: hidden for viewers.
- `seasons/SeasonsTab.tsx`, `SeasonHeader.tsx` (Edit), `SeasonMatches.tsx` (new / delete match), `SeasonOpponents.tsx`, `OpponentRow.tsx`.
- `app/team/[teamId]/season-new.tsx`, `match-new.tsx` guards; `matchForm/*`.
- `settings/useImport.ts` + `ImportSection.tsx`: shared-team protection and preview note; `ExportSection.tsx`: consistency warning.
- `src/features/sync/**`: `SyncBadge`, `ReadOnlyNote`, `SyncNotices`.
- `ProfileHeader.tsx`, `app/(tabs)/teams.tsx`: badge, notices, "Join a team" button.

Unchanged and allowed for viewers: print and PDF, export, stats, performance, rotation.

### 7.4 Guided tour

Add `TourPage` values `'account' | 'signIn' | 'cloudTeams' | 'members' | 'join'` to `OTHER_PAGES`. Steps go in `steps.ts` and the strings in `src/i18n/{en,de}/tour.ts`, all written in the foundation. Each screen calls `useTourPage(...)`.

### 7.5 i18n

Stub files: `src/i18n/{en,de}/account.ts` (C), `members.ts` (D), `sync.ts` (foundation writes the status and view-only strings both C and E use; E extends them). Nav titles go in `en.ts` / `de.ts`.

### 7.6 Owner dashboard steps (`docs/SUPABASE.md`, written by A)

1. Auth → Emails → **SMTP**: custom SMTP. Prefer an EU provider; the built-in sender only reaches org members, about 2 per hour.
2. Templates **Magic Link** _and_ **Confirm signup**: body contains `{{ .Token }}` and no link.
3. Email provider on, **Email OTP length 6**, OTP expiry 600 s.
4. Raise the email rate limit after SMTP.
5. Anonymous sign-ins off.
6. Check that the region is eu-central-2 (Zurich).
7. Re-enable the keepalive workflow if GitHub disabled it.

---

## 8. Work breakdown

### Foundation (orchestrator, one PR, merged before C / D / E start; A may start at once)

- Version **10.0.0** (`app.json` + `package.json` + lock).
- `EXPO_OFFLINE=1 npx expo install @supabase/supabase-js react-native-url-polyfill`, recorded in DECISIONS.
- `src/domain/types.ts` (sync types, `TourPage` additions).
- `exportFormat.ts` (export entity schemas).
- `src/domain/syncAccess.ts` + tests.
- `src/store/{types,appStore,migrations,photoStore,syncRuntime,syncHooks,index}.ts` + migration tests v1 → v13.
- `src/lib/sync/{index,types}.ts`: interface with stubs returning `{ok:false,error:'offline'}`, `isSyncConfigured`, `__mocks__/index.ts`.
- `jest.setup.ts`: `jest.mock('@/lib/sync')`.
- ESLint rules; `tsconfig` exclude.
- `supabase/public-config.json` (URL `https://qzeergfqfwovcvdarwua.supabase.co` plus the publishable key from MCP `get_publishable_keys`) and `app.config.js` `extra.supabase`.
- Placeholder route files for §7.1, `_layout` Stack entries plus `SyncHost`, `parentRoute` cases.
- i18n stub files, tour pages, steps and strings.
- `docs/PLAN.md` §44–45, DECISIONS #253+.

### Workers (each gets a branch, PR, independent reviewer, and no edits to DECISIONS)

| Worker                                              | Owns                                                                                                                                                                                                                                                                                                                                                                                         | Depends on                                                           | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A: backend**                                      | `supabase/**` (migrations, `tests/rls.sql`, `functions/delete-account`, `config.toml`), `.github/workflows/supabase-keepalive.yml`, `scripts/sync-live-check.mjs` (interactive Node + supabase-js: two emails, codes typed in; create / push / pull / join / player-push-denied / remove; not in CI), `docs/SUPABASE.md`, `src/lib/sync/database.types.ts` (MCP `generate_typescript_types`) | none                                                                 | RLS script T1–T29 green via `execute_sql`; advisors clean. Applies migrations with `apply_migration` and deploys the function after its review passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **B: sync domain, then engine** (two PRs, in order) | PR 1: `src/domain/{syncRecords,syncSchema,syncChanges,syncMerge,syncRepair,syncStatus,syncImport,syncUpload,invites}.ts` + tests. PR 2: `src/lib/sync/**` except `__mocks__` (C/D/E don't touch it), `src/test-utils/fakeBackend.ts`                                                                                                                                                         | PR 1 → foundation. PR 2 → PR 1, A's types.                           | Domain 100%. Property-style tests: two-device LWW, tombstones, resurrection, cascade, foreign-id skip, cursor overlap, starters singleton, description / profileId preservation, repair idempotence (`repair(repair(x)) = repair(x)`), and `isConsistent(team)` after repair (except number duplicates). Engine with the in-memory fake backend running the server's LWW: two devices converge; offline → pending → recovers; paused (5xx) → offline, no data change; demotion → `resetToCloud`; removal → unlink and keep the copy; photos upload before records, download before apply, prune exemption; no network calls when no team is linked. |
| **C: accounts**                                     | `app/account/**`, `src/features/account/**`, `src/features/profile/{ProfileScreen,useLeaveProfile}.ts(x)`, `src/features/settings/DeleteAllSection.tsx`, `src/i18n/{en,de}/account.ts`                                                                                                                                                                                                       | foundation (mocked `@/lib/sync`)                                     | Component tests: sign-in code flow, wrong code, offline; setup picker (upload unchecked by default, download checked); account switch confirm; Log out signs out; Delete all data signs out and keeps the cloud text; delete account blocked list / success keeps local data                                                                                                                                                                                                                                                                                                                                                                        |
| **D: members & join**                               | `app/team/[teamId]/members.tsx`, `app/team/[teamId]/index.tsx` (header button only), `app/join.tsx`, `src/features/members/**`, `src/i18n/{en,de}/members.ts`                                                                                                                                                                                                                                | foundation                                                           | Members list per role, invite create / share / revoke, role change, last-manager error shown, leave, join via link param, join while signed out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **E1: view-only, match side**                       | `src/features/{lineup,live,presets}/**`, `app/match/**`, `app/team/[teamId]/{preset/[presetId],starters}.tsx`                                                                                                                                                                                                                                                                                | foundation (`useMatchAccess`, `useCanEdit`)                          | Builder read-only (no drag, no tap placement, note shown); live read-only plus held + Take over; presets hidden                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **E2: view-only, team side + status UI**            | `src/features/{roster,seasons,matchForm,playerDetail,descriptions,sync}/**`, `src/features/settings/{useImport.ts,ImportSection.tsx,ExportSection.tsx}`, `app/team/[teamId]/{player,match-new,season-new,players/[playerId]}.tsx`, `app/(tabs)/teams.tsx`, `src/i18n/{en,de}/sync.ts` (extend)                                                                                               | foundation; `importWithSharedTeams` from B PR 1 (stub it until then) | Roster / seasons / player read-only; shared-team delete dialog (both roles); import keeps a viewer team, Replace keeps shared teams; badge states; notices                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Order:**

1. Foundation, with A in parallel.
2. B PR 1, C, D, E1 and E2 in parallel.
3. B PR 2.
4. Integration QA by the orchestrator: two browsers on the web build against the real project, at 375 and 1280 px, in German with the dyslexia font, light and dark.
5. Owner configures SMTP.
6. Release.

**One release (10.0), not 10.0 + 10.1.** Each part depends on the others: sync without roles is unsafe, roles without view-only are broken, and accounts without sync are pointless. Splitting would also ship the v13 shape twice. Realtime is the only optional part and is deferred to a later version if the owner wants it. The release is blocked until SMTP and templates are configured; otherwise sign-in can't work for anyone outside the org.

---

## 9. v10 acceptance checklist (for PLAN.md) and decisions

### Checklist

- [ ] Without signing in the app behaves like 9.2: no network calls, every screen unchanged in the screenshot compare (except Profile → Account and the team header's Members button).
- [ ] Sign in with a 6-digit email code (EN + DE); wrong or expired code messages; resend after 60 s.
- [ ] First sign-in offers Upload (nothing pre-selected) and Download; nothing uploads without a tap.
- [ ] Edits on device A appear on device B after Sync now / focus / ≤ 60 s; the same record edited on both → the later save wins per record (player, match, set, preset, starters, season, opponent, team fields).
- [ ] Deletions sync (tombstones); a deleted season with a newer match added elsewhere comes back instead of losing the match.
- [ ] Descriptions never leave the device and survive pulls; team and player photos sync (private bucket); profile photos stay local.
- [ ] Offline or paused project: the app works, the badge says Offline with pending count, no error screen, nothing lost; it syncs when back.
- [ ] Roles: a player sees everything read-only, with a reason on every edit control (builder drag + tap, live, presets, starters, roster, seasons, opponents, matches, team rename / photo, import of that team).
- [ ] Managers create, share and revoke invite codes (they expire); joining by code and by `volleylineup://join?code=` link works; roles change; members can be removed; the last manager can't leave or demote themselves.
- [ ] Removed member: the team stops syncing and stays as a local copy with a notice.
- [ ] Live: the scoring device holds the match; other managers see "Being scored on …" plus Take over; viewers see the score update within ~15 s.
- [ ] Delete team: "this device" vs "for everyone"; Leave team. Delete all data and Delete profile sign out and keep cloud teams. Delete account removes server data (blocked when the user is the last manager with others) and keeps local data.
- [ ] Import Replace / Merge never removes a shared team; viewer teams are skipped.
- [ ] Store v12 → v13 migration (plus v1 → v13); export schema 10 unchanged; golden byte-identical; old files import.
- [ ] RLS script T1–T29 passes on the real project; advisors clean; keepalive workflow green on dispatch.
- [ ] `@supabase/*` imported only in `src/lib/sync` (lint); lint, typecheck and tests pass; `src/domain` at 100%; a component test per feature.

### Decisions (one line each)

- Sync meta goes in the main store (v13), so records and base are written atomically.
- Dirty detection is by payload hash against base; no stamps in actions.
- Record granularity: team, player, season, opponent, match metadata, set (`<matchId>/<n>`), preset, starters (logical singleton per team).
- LWW is by clamped client save time, decided on the server (`push_records`), with `(at, device_id)` as the tie-break.
- The pull cursor is a server sequence with a 10 s overlap, so no commit-order gaps.
- A team vanishing locally means unlink, never delete; deleting for everyone is an explicit RPC.
- Parent tombstones cascade locally, unless a newer child edit (or a played set for players) resurrects the parent.
- Remote rows are validated (zod) and repaired deterministically; same-name seasons and opponents are merged; preset names are suffixed; duplicate numbers get a warning only.
- Composite record keys; global team ids; a taken id is rekeyed locally.
- Writes go only through SECURITY DEFINER RPCs; tables are SELECT-only via RLS; EXECUTE is revoked from PUBLIC and anon.
- The live hold is an advisory 15-min lease (`match_holds`); Take over is for managers; offline scoring is never blocked.
- No Realtime in 10.0; a 15 s poll while watching live, 60 s otherwise (free tier, less code).
- Account deletion uses an Edge Function (storage cleanup plus the admin API); it is blocked while the user is the last manager of a team with other members; sole-member teams are deleted.
- One account per device, linked to one profile; Log out signs out with scope 'local'.
- Downloads are explicit and checked by default; uploads are explicit and unchecked by default.
- Member display name = profile name; no member emails shown.
- Photos are immutable objects `team-photos/<teamId>/<photoId>`; managers garbage-collect unreferenced ones.
- Export `schemaVersion` stays 10 (no file change).
- `react-native-url-polyfill` on native only; supabase-js session in AsyncStorage.
- Public config (URL plus publishable key) lives in `supabase/public-config.json`, shared by `app.config.js` and the keepalive workflow.
- Viewers can't edit local descriptions either: one simple read-only rule.
- One 10.0 release; Realtime is a possible follow-up.

---

## 10. Risks and what needs a real phone

**Risks:**

- **Scope.** This is the largest change so far. The merge and repair rules are the riskiest part, which is why the domain is pure, at 100% coverage, and has the multi-device fake-backend tests.
- **Advisory hold.** Offline double-scoring loses one device's rallies for that set (LWW on the whole set).
- **Clock skew.** A device whose clock is behind loses more conflicts. Clamping only stops clocks that are ahead.
- **Blob writes.** About one extra whole-blob write per rally for shared teams. The 1 MB-per-season blob is already in the AUDIT; splitting match storage is the follow-up.
- **Duplicate jersey numbers** from concurrent offline adds block the user's _own export → import_ until fixed. The roster and export warnings cover this.
- **Email delivery** depends on owner SMTP setup; codes land in spam.
- **Keepalive** is disabled by GitHub after 60 days of no repo activity; the project then pauses, which the app treats as offline.
- **Edge function env.** Variable names under the new API keys (`SUPABASE_SERVICE_ROLE_KEY` vs secret keys) need checking at deploy.
- **Garbage objects.** Partial photo cleanup failures leave inaccessible objects (harmless).

**Not verifiable without a real phone:**

- the URL polyfill need and supabase-js on Hermes;
- session persistence in Android AsyncStorage across restarts;
- `FileReader.readAsDataURL` on downloaded Blobs, and `atob` byte decoding for uploads;
- the one-time-code keyboard and autofill;
- the `volleylineup://join` deep link from a messenger;
- AppState focus / background sync and the background push flush;
- the hold flow across two physical devices in a gym with poor network;
- the store v12 → v13 upgrade in Android AsyncStorage;
- APK behaviour when the project is paused.

Web (two browsers), Jest and the RLS SQL script cover the rest.

### Critical files for implementation

- `src/store/appStore.ts`
- `src/store/migrations.ts`
- `src/store/photoStore.ts`
- `src/domain/exportFormat.ts`
- `src/domain/types.ts`
- `src/domain/exportConsistency.ts`
- `src/domain/exportMerge.ts`
- `src/features/settings/useImport.ts`
- `src/features/lineup/LineupBuilder.tsx`
- `src/features/live/useLiveSet.ts`
- `app/_layout.tsx`
- `eslint.config.js`
- `app.config.js`
