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
  most 100 kB; a deletion is a tombstone (`deleted = true`, `payload` null). Player descriptions
  and profile data never leave the device.
- **Last write wins** per record: the server keeps the write with the newer
  `(client_updated_at, device_id)`. The client time is clamped to at most one minute ahead of
  the server. Every write gets a new `version` from a sequence; clients pull with
  `version > cursor`.
- **`invites`**: 10-character codes for a role, valid 1–30 days, revocable. Only managers see
  them.
- **`match_holds`**: the device that scores a match live holds it for 15 minutes (advisory).
- **`keepalive`**: one row, readable by `anon`, for the keep-alive workflow.
- **Storage**: private bucket `team-photos`, objects `<teamId>/<photoId>` (JPEG / PNG / WebP, at
  most 256 kB). Members read, managers upload and delete; no updates (a new photo gets a new id).

### Security model

- Every table has RLS enabled. `authenticated` has **SELECT only**, filtered to the teams the user
  belongs to (invites: teams they manage). `anon` has no access except `keepalive`.
- All writes go through the RPCs below. They are `SECURITY DEFINER` with `search_path = ''`,
  check `auth.uid()` and the caller's role themselves, and are executable by `authenticated`
  only (EXECUTE is revoked from `public` and `anon`).
- Policy helpers live in the schema `private`, which the Data API doesn't expose:
  `my_team_ids()`, `my_managed_team_ids()` (used as `team_id in (select …)`, evaluated once per
  query) and `is_team_member(text)`, `is_team_manager(text)` (used inside RPCs). They are
  `SECURITY DEFINER` so the `team_members` policy can read `team_members` without recursion.
- Triggers on `team_members`: the **last-manager guard** (the last manager can't be demoted or
  removed while other members remain), **drop empty team** (a team without members is deleted)
  and **drop member holds** (leaving, removal or demotion ends the member's live holds).
  `delete_team` and `delete_my_account` switch the guard off for their own transaction with
  `set_config('app.bypass_member_guard', 'on', true)`.

### RPCs

| RPC                                                                                          | Who                   | What                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_team(p_team_id, p_display_name) → text`                                              | signed in             | Creates the team with the caller as manager → `'created'`. Existing id → `'member'` (caller already belongs to it) or `'taken'` (someone else's: the app re-keys its team). At most 50 managed teams. |
| `leave_team(p_team_id)`                                                                      | member                | Leaves. The only member must delete the team instead.                                                                                                                                                 |
| `set_member_role(p_team_id, p_user_id, p_role)`                                              | manager               | Changes a member's role (also one's own, unless last manager).                                                                                                                                        |
| `remove_member(p_team_id, p_user_id)`                                                        | manager               | Removes a member.                                                                                                                                                                                     |
| `delete_team(p_team_id)`                                                                     | manager               | Deletes the team for everyone (members, records, invites, holds). The app removes its photos first.                                                                                                   |
| `push_records(p_team_id, p_device_id, p_records) → jsonb`                                    | manager               | Writes up to 200 records / 1 MB, last write wins. Returns per record `{kind, id, applied, version, at, updated_at, deleted}` plus `payload` when the server kept a newer row.                         |
| `pull_changes(p_team_id, p_after, p_limit = 500) → jsonb`                                    | member (invoker, RLS) | `{server_now, rows}`: records with `version > p_after`, oldest first, at most 1000.                                                                                                                   |
| `create_invite(p_team_id, p_role, p_days = 7) → jsonb`                                       | manager               | New code `{id, code, role, expires_at}`; 1–30 days, at most 20 active per team.                                                                                                                       |
| `revoke_invite(p_invite_id)`                                                                 | manager               | Revokes a code.                                                                                                                                                                                       |
| `join_team(p_code, p_display_name) → jsonb`                                                  | signed in             | Joins with a code (dashes, spaces and case ignored) → `{team_id, role}`. A code never lowers a role.                                                                                                  |
| `hold_match(p_team_id, p_match_id, p_device_id, p_holder_name, p_take_over = false) → jsonb` | manager               | Claims or refreshes the 15-minute hold → `{granted, holder_name, held_until}`; another device's live hold needs `p_take_over`.                                                                        |
| `release_match(p_team_id, p_match_id, p_device_id)`                                          | manager               | Ends this device's hold.                                                                                                                                                                              |
| `account_deletion_check() → jsonb`                                                           | signed in (invoker)   | `{delete_teams, blocked_teams}`: teams deleted with the account (caller is the only member) and teams that block it (caller is the last manager, others remain).                                      |
| `delete_my_account() → text[]`                                                               | signed in             | Deletes the caller's sole-member teams and the auth user (memberships, holds and sessions cascade); returns the deleted team ids. The app removes those teams' photos first.                          |

### Error codes

| SQLSTATE | Meaning                                                                      | App error       |
| -------- | ---------------------------------------------------------------------------- | --------------- |
| `42501`  | forbidden (not signed in, not a member, not a manager; PostgREST: 401 / 403) | `forbidden`     |
| `VL001`  | last manager (detail: blocked team ids for `delete_my_account`)              | `lastManager`   |
| `VL002`  | invite code unknown, expired or revoked                                      | `inviteInvalid` |
| `VL004`  | last member: delete the team instead                                         | `lastMember`    |
| `VL006`  | too many teams (50 managed)                                                  | `tooMany`       |
| `VL007`  | team full (20 000 records or 20 active invites)                              | `tooMany`       |
| `22023`  | bad batch or argument (size, shape, role, days)                              | `unknown`       |
| `23514`  | a record breaks a CHECK (kind, id, payload size, singleton id)               | `unknown`       |

## Applying the migrations

The files in `supabase/migrations` are the whole schema and must be applied in file-name order,
once, to an empty project.

- **Supabase CLI** (hosted or self-hosted): `supabase link --project-ref <ref>` then
  `supabase db push`. Locally, `supabase start` applies them automatically.
- **psql**: `for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done`
  as `postgres`.
- **MCP / dashboard**: run each file in order (`apply_migration` or the SQL editor).

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

| Tests    | What                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| T1–T3    | create teams, push and pull, invite and join as player                                 |
| T4–T6    | a stranger reads nothing, can't call any team RPC, can't hijack a team id              |
| T7–T9    | a player reads records and members but no invites, can't write through RPCs or tables  |
| T10      | a manager of another team has no access                                                |
| T11–T13  | storage: upload, read and delete by role, one folder level only                        |
| T14–T16  | last write wins with the device tie-break, clock clamp, tombstones                     |
| T17      | CHECKs and limits (kinds, sizes, batch size, team full, too many teams, invite args)   |
| T18, T23 | last manager and last member                                                           |
| T19, T20 | leaving / removed members lose access to records, members, holds and photos            |
| T21, T22 | expired, revoked and unknown codes; codes never downgrade                              |
| T24      | live holds: refusal, take-over, expiry, release                                        |
| T25, T26 | account deletion: `anon` refused, blocked teams (VL001), sole teams deleted, user gone |
| T27      | delete for everyone; dashboard deletion of a sole member drops the empty team          |
| T28, T29 | `anon`: keepalive only, no tables, no RPCs                                             |
| T30      | catalogue: grants, `search_path`, RLS and policies on every table                      |

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

## Keep-alive

The free tier pauses a project after about 7 days without activity. The workflow
`.github/workflows/supabase-keepalive.yml` reads the `keepalive` row every 3 days (05:17 UTC) with
the publishable key and fails loudly if it can't. Run it by hand under Actions → "Supabase
keep-alive" → "Run workflow".

- **GitHub disables scheduled workflows** in public repositories after 60 days without commits.
  The keep-alive run doesn't count. If that happens: Actions → "Supabase keep-alive" →
  **Enable workflow**.
- **If the project paused anyway**, the app shows "Offline" and keeps working locally; nothing is
  lost. The owner restores it: Supabase dashboard → the project → **Restore project**. It takes a
  few minutes; devices sync again on their next cycle.

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
   hour" to what the provider allows (e.g. 30–100). Keep the OTP / verify limits.
5. **Anonymous sign-ins off** (Authentication → Sign In / Providers).
6. Check the region is **eu-central-2 (Zurich)** (Project Settings → General).
7. If GitHub disabled the keep-alive workflow, enable it again (see [Keep-alive](#keep-alive)).

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

The **performance** advisor may list "Unused Index" (INFO) for the new indexes until the app has
traffic; they back the RLS filters, the pull cursor and the foreign keys and stay.
