# Supabase backend (v10)

Accounts and cloud sync (v10.0) use one Supabase project. This page is for developers and for the
owner of the project. The app design lives in `docs/PLAN.md` §44–45; this page covers the
server side only.

## Project

|               |                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Name          | Volleylineup manager                                                                                       |
| Ref           | `qzeergfqfwovcvdarwua` (`https://qzeergfqfwovcvdarwua.supabase.co`)                                        |
| Region        | eu-central-2 (Zurich)                                                                                      |
| Plan          | Free tier (pauses after about 7 days without activity, see [Keep-alive](#keep-alive))                      |
| Postgres      | 17                                                                                                         |
| Public config | `supabase/public-config.json` (URL + publishable key; read by `app.config.js` and the keep-alive workflow) |

There is **no service-role key** anywhere: not in the repository, not in the app, not in a
function. Everything the app does runs as the signed-in user (`authenticated`), and the database
checks every write itself.

Files:

| Path                                                      | What                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `supabase/migrations/*.sql`                               | The whole schema, applied in file-name order                                |
| `supabase/tests/rls.sql`                                  | RLS and RPC tests T1–T30, in one rolled-back transaction                    |
| `supabase/tests/test-users.sql`, `test-users-cleanup.sql` | Password test users for the live check and QA                               |
| `supabase/config.toml`, `supabase/templates/*.html`       | Supabase CLI config (local / self-hosted) and the code-only email templates |
| `scripts/sync-live-check.mjs`                             | End-to-end check against the real project (not in CI)                       |
| `.github/workflows/supabase-keepalive.yml`                | Keeps the free project awake                                                |

## Schema

### Model

- A **team** (`teams.id` = the app's team id) is shared by its **members** (`team_members`), each
  a `manager` or a `player`. Managers write; players only read.
- Each synced entity is one row in **`team_records`**, keyed by `(team_id, kind, id)`. `kind` is
  one of `team`, `player`, `season`, `opponent`, `match`, `set` (id `<matchId>/<n>`), `preset`,
  `starters` (`team` and `starters` use the team id). `payload` is the JSON of the entity, at
  most 64 kB; a deletion is a tombstone (`deleted = true`, `payload` null). Player descriptions
  and profile data never leave the device.
- **Last write wins** per record: the server keeps the write with the newer
  `(client_updated_at, device_id)`. The client time is truncated to milliseconds and clamped to
  at most one minute ahead of the server. Timestamps come back as ISO strings with milliseconds
  (`2026-01-01T10:00:00.000Z`, like `Date.toISOString()`), so `at` is exactly what the client
  sent unless it was clamped.
- **Pull cursor**: every write gets a new `version` from a sequence and, right after it, its
  `updated_at` from the clock. Clients pull `version > cursor` and only move the cursor past rows
  older than `server_now − 10 s`. This is safe because a write can't run longer than the
  `authenticated` role's **statement_timeout of 8 s** (the Supabase default), so a version that
  isn't committed yet always belongs to a row less than 8 s old. **Self-hosted projects must set
  it too**: `alter role authenticated set statement_timeout = '8s';`.
- **`invites`**: 10-character codes for a role, revocable. Player codes: many uses, 1–30 days.
  Manager codes: **one use**, 1–7 days. Only managers see them. A member who was removed can't
  rejoin with a code created before the removal; a newer code is a deliberate re-invite.
- **`match_holds`**: the device that scores a match live holds it for 15 minutes (advisory).
- **`keepalive`**: one row, readable by `anon`, for the keep-alive workflow.
- **Storage**: private bucket `team-photos`, objects `<teamId>/<photoId>` (JPEG / PNG / WebP, at
  most 256 kB). Members read, managers upload and delete; no updates (a new photo gets a new id).

### Limits

The free tier has 500 MB of database and 1 GB of file storage for everyone, so one account must
not be able to fill it:

| Limit                                                                   | Error                    |
| ----------------------------------------------------------------------- | ------------------------ |
| 10 teams created per user (existing ones)                               | `VL006`                  |
| 20 MB per team: payloads + 512 bytes per record (`teams.payload_bytes`) | `VL007`                  |
| 20 000 records per team                                                 | `VL007`                  |
| 64 kB per record, 200 records / 1 MB per push                           | `23514` / `22023`        |
| 150 photos per team (256 kB each)                                       | `42501` (storage policy) |
| 20 usable invites per team                                              | `VL007`                  |
| 50 active live holds per team (holds expired over a day ago are pruned) | `VL007`                  |

Worst case for one account: 10 teams × 20 MB = 200 MB of records (the 512 bytes per record cover
row, index and tombstone overhead, so a team of many tiny records still counts as what it costs)
and 10 × 150 × 256 kB = 375 MB of photos.

### Security model

- Every table has RLS enabled. `authenticated` has **SELECT only**, filtered to the teams the user
  belongs to (invites: teams they manage). `anon` has no access except `keepalive`.
- All writes go through the RPCs below. They are `SECURITY DEFINER` with `search_path = ''`,
  check `auth.uid()` and the caller's role themselves, and are executable by `authenticated`
  only (EXECUTE is revoked from `public` and `anon`).
- The schema `private` isn't exposed by the Data API. It holds the policy helpers
  `my_team_ids()`, `my_managed_team_ids()` (used as `team_id in (select …)`, evaluated once per
  query), `is_team_member(text)`, `is_team_manager(text)` (used inside RPCs) and
  `team_photo_count(text)` (photo limit, leftover-photo checks; it reads the folder as a C-collation
  name range, so the `(bucket_id, name)` index is used; the bucket isn't versioned, so it doesn't
  filter archived versions or delete markers: if versioning is ever turned on for `team-photos`,
  add `archived_at is null and not coalesce(is_delete_marker, false)` there, or deletes of old
  teams stay blocked by `VL008`). They are `SECURITY DEFINER` so
  the `team_members` policy can read `team_members` without recursion. It also holds the table
  `team_removals` (who was removed when), which no API role can read.
- Triggers on `team_members`: the **last-manager guard** (the last manager can't be demoted or
  removed while other members remain), **drop empty team** (a team without members is deleted)
  and **drop member holds** (leaving, removal or demotion ends the member's live holds).
  `delete_team` and `delete_my_account` switch the guard off for their own transaction with
  `set_config('app.bypass_member_guard', 'on', true)`.
- **Member changes lock the team row** (`select … for update`): the guard, `leave_team`,
  `remove_member`, `set_member_role`, and `delete_my_account` (all the caller's teams, in id
  order). Two managers demoting or removing each other at the same moment are serialized, so a
  team never ends up without a manager.
- **Photos before teams**: `delete_team` and `delete_my_account` refuse with `VL008` while the
  team's storage folder still has photos (the app deletes them through the Storage API first),
  and `create_team` answers `'taken'` for an id whose folder still has photos. A new team can
  never see an old team's pictures.

### RPCs

| RPC                                                                                          | Who                   | What                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_team(p_team_id, p_display_name) → text`                                              | signed in             | Creates the team with the caller as manager → `'created'`. Existing id → `'member'` (caller already belongs to it) or `'taken'` (someone else's, or old photos remain: the app re-keys its team). At most 10 created teams. |
| `leave_team(p_team_id)`                                                                      | member                | Leaves. The only member must delete the team instead.                                                                                                                                                                       |
| `set_member_role(p_team_id, p_user_id, p_role)`                                              | manager               | Changes a member's role (also one's own, unless last manager).                                                                                                                                                              |
| `remove_member(p_team_id, p_user_id)`                                                        | manager               | Removes a member and records the removal (older codes stop working for them).                                                                                                                                               |
| `delete_team(p_team_id)`                                                                     | manager               | Deletes the team for everyone (members, records, invites, holds). `VL008` while photos remain: the app removes them first.                                                                                                  |
| `push_records(p_team_id, p_device_id, p_records) → jsonb`                                    | manager               | Writes up to 200 records / 1 MB, last write wins. Returns per record `{kind, id, applied, version, at, updated_at, deleted, device_id}` plus `payload` when the server kept a newer row.                                    |
| `pull_changes(p_team_id, p_after, p_limit = 500) → jsonb`                                    | member (invoker, RLS) | `{server_now, rows}`: records with `version > p_after`, oldest first, at most 1000. Each row: `{kind, id, payload, deleted, at, updated_at, version, device_id}`.                                                           |
| `create_invite(p_team_id, p_role, p_days = 7) → jsonb`                                       | manager               | New code `{id, code, role, expires_at, max_uses}`; players 1–30 days and unlimited uses, managers 1–7 days and one use. At most 20 usable per team.                                                                         |
| `revoke_invite(p_invite_id)`                                                                 | manager               | Revokes a code.                                                                                                                                                                                                             |
| `join_team(p_code, p_display_name) → jsonb`                                                  | signed in             | Joins with a code (dashes, spaces and case ignored) → `{team_id, role}`. A code never lowers a role.                                                                                                                        |
| `hold_match(p_team_id, p_match_id, p_device_id, p_holder_name, p_take_over = false) → jsonb` | manager               | Claims or refreshes the 15-minute hold → `{granted, holder_name, held_until}`; another device's live hold needs `p_take_over`.                                                                                              |
| `release_match(p_team_id, p_match_id, p_device_id)`                                          | manager               | Ends this device's hold.                                                                                                                                                                                                    |
| `account_deletion_check() → jsonb`                                                           | signed in (invoker)   | `{delete_teams, blocked_teams}`: teams deleted with the account (caller is the only member) and teams that block it (caller is the last manager, others remain).                                                            |
| `delete_my_account() → text[]`                                                               | signed in             | Deletes the caller's sole-member teams and the auth user (memberships, holds and sessions cascade); returns the deleted team ids. `VL008` while those teams still have photos: the app removes them first.                  |

### Error codes

| SQLSTATE | Meaning                                                                             | App error       |
| -------- | ----------------------------------------------------------------------------------- | --------------- |
| `42501`  | forbidden (not signed in, not a member, not a manager; PostgREST: 401 / 403)        | `forbidden`     |
| `VL001`  | last manager (detail: blocked team ids for `delete_my_account`)                     | `lastManager`   |
| `VL002`  | invite code unknown, expired, revoked or used up, or the user was removed after it  | `inviteInvalid` |
| `VL004`  | last member: delete the team instead                                                | `lastMember`    |
| `VL006`  | too many teams (10 created)                                                         | `tooMany`       |
| `VL007`  | team full (20 MB, 20 000 records, 20 usable invites or 50 live holds)               | `tooMany`       |
| `VL008`  | photos remain: delete the team's photos first (detail: team ids)                    | (app retries)   |
| `22023`  | bad batch or argument (size, shape, `at` not a finite time, role, days)             | `unknown`       |
| `23514`  | a record breaks a CHECK (kind, id, payload over 64 kB, singleton id; team id shape) | `unknown`       |

## Applying the migrations

The files in `supabase/migrations` are the whole schema and must be applied in file-name order,
once, to an empty project. Their names start with the version (`20261125HHMMSS`).

- **The hosted project** is applied with the MCP tool `apply_migration`, one file at a time in
  order. That records each migration under the time it ran, so afterwards the orchestrator sets
  the recorded versions in `supabase_migrations.schema_migrations` to the file versions
  (`20261125090000` … `20261125090600`). Then `supabase db push` sees them as applied and stays
  in sync.
- **Other projects** (new, self-hosted, local): `supabase link --project-ref <ref>` and
  `supabase db push`, or psql in file order:
  `for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
  (as `postgres`). Locally, `supabase start` applies them automatically. Self-hosted: keep the
  `authenticated` statement_timeout at 8 s (see [Model](#model)).

Afterwards: run the RLS tests, check the advisors (Dashboard → Advisors, or MCP `get_advisors`
for `security` and `performance`), and regenerate the app's types
(`src/lib/sync/database.types.ts`, MCP `generate_typescript_types` or
`supabase gen types typescript --project-id <ref>`).

The project was created with "automatically expose new tables" **off** and "enable RLS on new
tables" **on**. The migrations don't rely on either: they enable RLS and grant explicitly.

## RLS tests

`supabase/tests/rls.sql` runs as `postgres` on a database with the migrations applied (SQL
editor, `psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql`, or MCP `execute_sql`). It creates
its own users (`rls-*@example.test`), switches between them with `set local role` and the JWT
claims, and rolls everything back at the end, so it leaves nothing behind.

A failing check raises `FAIL T<n> …` and stops. Success ends with `ALL RLS TESTS PASSED`.

| Tests    | What                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| T1–T3    | create teams (team id shape), push and pull (ISO ms times, device id, clock `updated_at`), invite and join                              |
| T4–T6    | a stranger reads nothing, can't call any team RPC, can't hijack a team id                                                               |
| T7–T9    | a player reads records and members but no invites, can't write through RPCs or tables, can't read removals                              |
| T10      | a manager of another team has no access                                                                                                 |
| T11–T13b | storage: upload, read and delete by role, one folder level only, at most 150 photos                                                     |
| T14–T16  | last write wins with the device tie-break, clock clamp, millisecond times, tombstones                                                   |
| T17      | CHECKs and limits (kinds, 64 kB, infinite times, batch size, byte budget with row overhead, 20 MB and 20 000 records, 10 created teams) |
| T18, T23 | last manager and last member                                                                                                            |
| T19, T20 | leaving / removed members lose access; T20b: old codes refused after a removal, a new code works                                        |
| T21, T22 | expired, revoked and unknown codes; codes never downgrade; T22b: manager codes are single use                                           |
| T24      | live holds: refusal, take-over, expiry, release; T24b: 50 active holds, pruning                                                         |
| T25, T26 | account deletion: `anon` refused, blocked teams (VL001), photos first (VL008), sole teams deleted                                       |
| T27      | delete for everyone (photos first, VL008); T27b: leftover photos make an id `'taken'`; dashboard deletion                               |
| T28, T29 | `anon`: keepalive only, no tables, no RPCs                                                                                              |
| T30      | catalogue: grants, `search_path`, RLS and policies, private bucket, team-row locks                                                      |

The team-row locks prevent a race between two sessions; one transaction can't reproduce it, so
T30 checks that the functions take the lock.

## Live check with test users

`scripts/sync-live-check.mjs` runs the main flows against the real project through the public
API, as two real users: create team, push, pull, stranger sees nothing, invite and join, player
push denied, older write ignored, hold and take over, removed member loses access, delete team.

1. Run `supabase/tests/test-users.sql` as `postgres`. It creates `vl-test-1@example.test`,
   `vl-test-2@example.test` and `vl-test-3@example.test` with a password (random, shown in the
   result; or set `vl.test_password` first). These users sign in with a password, which the app
   never offers; they exist for tests only.
2. `npm ci`, then `VL_TEST_PASSWORD=<password> node scripts/sync-live-check.mjs`. It prints
   PASS / FAIL per step and exits with 1 on a failure. It deletes its team at the end.
3. Run `supabase/tests/test-users-cleanup.sql` to delete the users (and teams only they belong
   to). Don't leave them on the project.

Web QA can sign in a test user with a password from a script and inject the session; the app
itself only offers the email code.

## Deleting users in the dashboard

Deleting a user under Authentication → Users is **blocked** (error `VL001`, last manager) while
they are the last manager of a team that has other members. Make someone else manager of that
team first (or delete the team in the app), then delete the user. Teams where the user was the
only member are deleted with them; their photos stay in the bucket, so remove the
`team-photos/<teamId>/` folder in Storage as well.

## Keep-alive

The free tier pauses a project after about 7 days without activity. The workflow
`.github/workflows/supabase-keepalive.yml` reads the `keepalive` row every 3 days (05:17 UTC) with
the publishable key and fails loudly if it can't. Run it by hand under Actions → "Supabase
keep-alive" → "Run workflow".

- **Until the migrations are applied** the `keepalive` table doesn't exist and the workflow
  fails with HTTP 404. That's expected; it passes once they are applied.
- **GitHub disables scheduled workflows** in public repositories after 60 days without commits.
  The keep-alive run doesn't count. If that happens: Actions → "Supabase keep-alive" →
  **Enable workflow**.
- **If the project paused anyway**, the app shows "Offline" and keeps working locally; nothing is
  lost. The owner restores it: Supabase dashboard → the project → **Restore project**. It takes a
  few minutes; devices sync again on their next cycle.
- **A free project paused for more than 90 days can't be restored from the dashboard** any more
  (only its data can be downloaded). Don't let it get that far: check the workflow runs now and
  then.

## Owner dashboard steps

Do these once in the Supabase dashboard. Until steps 1–3 are done, sign-in codes only reach
members of the Supabase organization.

1. **Custom SMTP** (Authentication → Emails → SMTP Settings): set up a provider (prefer one with
   EU hosting). The built-in sender only delivers to members of the organization, at about
   2 emails per hour, and is meant for testing.
2. **Email templates** (Authentication → Emails → Templates): replace the body of **Magic Link**
   _and_ **Confirm signup** with `supabase/templates/magic_link.html` and
   `supabase/templates/confirmation.html`. Both contain `{{ .Token }}` and no link: the app
   asks for the code. Subject: `Your Volley Lineup code: {{ .Token }}`.
3. **Email provider** (Authentication → Sign In / Providers → Email): enabled, **Email OTP
   length 6**, **Email OTP expiration 600** seconds. Keep "Confirm email" on.
4. **Rate limits** (Authentication → Rate Limits): after SMTP works, raise "emails sent per
   hour" to what the provider allows (e.g. 30–100). **Keep the sign-up, OTP and verify limits**:
   together with the per-user limits above they stop one person from creating many accounts to
   fill the free tier.
5. **Usage alert**: Organization → Usage (or Billing → Usage): check database and storage size
   regularly, and set up a usage notification if the plan offers one. The app's limits make
   filling 500 MB hard, not impossible.
6. **Anonymous sign-ins off** (Authentication → Sign In / Providers).
7. Check the region is **eu-central-2 (Zurich)** (Project Settings → General).
8. If GitHub disabled the keep-alive workflow, enable it again (see [Keep-alive](#keep-alive)).

Optional: in the SQL editor run
`revoke execute on function public.rls_auto_enable() from public, anon, authenticated;` to clear
the two advisor warnings about the project's own `rls_auto_enable()` event-trigger function (see
below).

## Advisor warnings that are intended

After the migrations, the **security** advisor lists these WARNs on purpose:

- **"Signed-In Users Can Execute SECURITY DEFINER Function"** (lint 0029) for `create_team`,
  `leave_team`, `set_member_role`, `remove_member`, `delete_team`, `push_records`,
  `create_invite`, `revoke_invite`, `join_team`, `hold_match`, `release_match` and
  `delete_my_account`. They are the app's write API: the tables are read-only for
  `authenticated`, so every write must run as the definer, and each function checks
  `auth.uid()` and the caller's role before writing. `pull_changes` and
  `account_deletion_check` are `SECURITY INVOKER` and don't appear. No RPC is executable by
  `anon` (lint 0028 stays clean for them).
- **`public.rls_auto_enable()`** (lints 0028 and 0029): not ours. Supabase created it for the
  project's "enable RLS on new tables" option before any migration ran. It is an event-trigger
  function, so calling it through the API fails; the owner can revoke EXECUTE (command above).
- **"RLS Enabled No Policy"** (INFO, lint 0008) on `private.team_removals`: on purpose. The table
  lives in the unexposed `private` schema and is closed to every API role; only the RPCs
  (`remove_member`, `join_team`) read and write it.
- **"Leaked Password Protection Disabled"** (WARN, auth): it doesn't apply. The app signs in only
  with a 6-digit email code and never uses passwords; only the test users in
  `supabase/tests/test-users.sql` have one, and they are deleted after each test run. The check
  (HaveIBeenPwned) is a paid-plan setting. Leave it off on the free tier, or turn it on in
  **Authentication → Providers → Email** if passwords are ever used.

Checked on the live project after applying the migrations (2026-11-25): security = exactly the
items above (12 RPCs + `rls_auto_enable` for 0029, `rls_auto_enable` for 0028, the 0008 INFO,
the leaked-password WARN);
performance = no findings. `supabase/tests/rls.sql` passed on the applied schema, and
`scripts/sync-live-check.mjs` passed every step with the test users (removed afterwards).

The **performance** advisor may list "Unused Index" (INFO) for the new indexes until the app has
traffic; they back the RLS filters, the pull cursor and the foreign keys and stay.
