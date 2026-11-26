# v10.0.0 audit: accounts and cloud sync

Audit of `main` @ `2af66a8` (app 10.0.0, released) on 2026-11-26. v10 was built by an orchestrator
and several worker agents (PRs #85–#95, DECISIONS #253–#291). This audit looks at the seams
between their parts: the database's access rules, the sync engine, the merge rules, the store
migration and the screens — not at code style.

How it was done: the lead auditor read every migration, the sync engine and the merge code, and
compared the repository with the live Supabase project (`qzeergfqfwovcvdarwua`) through the
connector. Three independent read-only agents covered existing users and backups, privacy /
secrets / leftovers, and screen resilience / view-only gating. Every HIGH finding below was
reproduced before it was written down: on the live database in a rolled-back transaction, or as
a failing Jest test. No sign-in email was sent; no test user or row was left on the project.

Baseline before any change: lint, typecheck and **2173 tests (168 suites)** pass; the latest
release is `v10.0.0`.

## Summary

| Severity      | Count | Fixed in this audit              |
| ------------- | ----- | -------------------------------- |
| CRITICAL      | 0     | –                                |
| HIGH          | 4     | all 4 (see "Fix log" at the end) |
| MEDIUM        | 10    | none (listed with the exact fix) |
| LOW / CLEANUP | 14    | none                             |

(Counts of the lead audit. The three side audits' findings are added under "Side audits" when
they finish; any CRITICAL or HIGH among them is written down here before it is fixed.)

Short version: the database's access rules are sound — a stranger, a signed-out caller, a player,
a manager of another team and a removed member are all kept out, and the live database is
exactly what the migration files say. The four HIGH findings are: invite codes that outlive the
access of the people who know them (**H1**, a real way back in for a demoted manager or a removed
member), used-up manager codes shown as usable (**H2**), a photo that can be wiped for the whole
team after one device's failed download (**H3**), and a pull cursor that can skip a record
(**H4**).

---

## Phase 1: what v10 added, and drift

### Map

- **Database** (`supabase/migrations/20261125090000…090600`, 7 files): tables `teams`,
  `team_members`, `team_records`, `invites`, `match_holds`, `keepalive` (public) and
  `team_removals` (private); 14 RPCs (12 `SECURITY DEFINER`, `pull_changes` and
  `account_deletion_check` invoker); 12 helper / trigger functions in the unexposed `private`
  schema; 4 triggers on `team_members` / `team_records`; private bucket `team-photos` with three
  storage policies; one SELECT policy per table.
- **App**: `src/lib/sync/` (client, backend adapter, engine, commands — the only place that
  imports `@supabase/*`), `src/domain/sync*.ts` + `invites.ts` + `syncAccess.ts` (pure rules),
  store v13 (`sync` slice, `syncRuntime`, `syncHooks`), screens `/account`, `/account/sign-in`,
  `/account/teams`, `/team/[teamId]/members`, `/join`, and view-only gating across the editors.
- **Auth** (public settings endpoint, checked 2026-11-26): email provider on, anonymous sign-ins
  off, sign-ups on, no auto-confirm, no other provider.

### Repository vs live database: no drift

| Checked                                                           | Result                                                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Migration history (`supabase_migrations.schema_migrations`)       | the 7 file versions, same names                                                                      |
| Tables, columns, defaults, constraints, indexes                   | identical to the files                                                                               |
| RLS enabled; policies (6 public, 3 storage)                       | identical                                                                                            |
| Table grants                                                      | `authenticated`: SELECT only; `anon`: SELECT on `keepalive` only; nothing else                       |
| All 26 function bodies (md5 of the whitespace-normalised source)  | identical, same `SECURITY DEFINER` flags, all with `search_path = ''`                                |
| EXECUTE grants                                                    | RPCs: `authenticated` only; trigger functions: nobody; `private` helpers: `authenticated`            |
| Triggers                                                          | identical                                                                                            |
| Bucket `team-photos`                                              | private, 256 kB, JPEG / PNG / WebP                                                                   |
| `authenticated` statement timeout (the pull cursor depends on it) | 8 s                                                                                                  |
| Realtime publication, GraphQL, Edge Functions                     | no tables published; `pg_graphql` not installed; no functions                                        |
| Data                                                              | 0 users, teams, records, invites, holds, objects; the `keepalive` row                                |
| Security advisor                                                  | the 12 intended RPC warnings + `rls_auto_enable` (0028 / 0029) + `team_removals` INFO, as documented |
| Performance advisor                                               | no findings                                                                                          |

One documentation difference: `docs/SUPABASE.md` also lists a "Leaked Password Protection
Disabled" warning; the advisor no longer reports it (L13).

### Mismatches between modules

- **Invites**: the database added `max_uses` (single-use manager codes, after the security
  review); the app's adapter and UI never read it → **H2**.
- **Photo "still downloading" list**: the engine keeps it in memory, the photo store's prune
  runs at app start before the engine → **H3**.
- **Pull paging**: the cursor rule in `docs/SUPABASE.md` assumes one server time per pull; the
  engine pages and keeps the last page's → **H4**.
- **Text limits**: pulled records are rejected over 200 / 1000 characters; pushed records
  aren't checked → **M3**.
- Field names (snake_case ↔ camelCase), timestamps (ISO with milliseconds; Postgres `timestamptz`
  JSON normalised by `normalizeTimestamp`), id formats (team id pattern, record id ≤ 200, device
  id ≤ 64) and error codes (SQLSTATE → `SyncErrorCode`) match between the SQL and
  `supabaseBackend.ts` / `syncSchema.ts` / `errors.ts`.
- `@supabase/*` is imported only inside `src/lib/sync` (ESLint enforces it).

---

## Phase 2: who can do what

Proved by reading the grants and policies on the live database, by the RLS test script
(`supabase/tests/rls.sql`, T1–T30, run on the live project during this audit by a helper agent
that sent the file through the connector: `ALL RLS TESTS PASSED`, nothing left behind),
and by calling the public API with the publishable key and no session.

| Object                                                                                                                             | Signed out (publishable key)               | Stranger (signed in, not a member)               | Player                                  | Manager                                     | Manager of another team | Removed member |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ | --------------------------------------- | ------------------------------------------- | ----------------------- | -------------- |
| `teams`, `team_members`                                                                                                            | 401 (no grant)                             | 0 rows                                           | read own teams                          | read own teams                              | 0 rows                  | 0 rows         |
| `team_records`, `pull_changes`                                                                                                     | 401                                        | 0 rows                                           | read                                    | read                                        | 0 rows                  | 0 rows         |
| `invites`                                                                                                                          | 401                                        | 0 rows                                           | **0 rows**                              | read own teams'                             | 0 rows                  | 0 rows         |
| `match_holds`                                                                                                                      | 401                                        | 0 rows                                           | read                                    | read                                        | 0 rows                  | 0 rows         |
| `private.team_removals`                                                                                                            | schema not exposed (406)                   | no access                                        | no access                               | no access                                   | no access               | no access      |
| `keepalive`                                                                                                                        | read the one row; no write (401)           | no access                                        | no access                               | no access                                   | no access               | no access      |
| Direct INSERT / UPDATE / DELETE                                                                                                    | 401 on every table                         | 42501 (no grant)                                 | 42501                                   | 42501 (writes only through RPCs)            | 42501                   | 42501          |
| `push_records`, `hold_match`, `release_match`, `create_invite`, `revoke_invite`, `set_member_role`, `remove_member`, `delete_team` | 401 (no EXECUTE)                           | 42501                                            | 42501                                   | allowed, on the team whose role was checked | 42501                   | 42501          |
| `create_team`                                                                                                                      | 401                                        | allowed (own new team; an existing id → `taken`) | same                                    | same                                        | same                    | same           |
| `join_team`                                                                                                                        | 401                                        | with a valid code only                           | with a valid code (never lowers a role) | same                                        | same                    | **see H1**     |
| `leave_team`                                                                                                                       | 401                                        | 42501                                            | allowed                                 | allowed unless last manager (VL001)         | 42501                   | 42501          |
| `account_deletion_check`, `delete_my_account`                                                                                      | 401                                        | own account only                                 | own account only                        | own account; VL001 while last manager       | own account             | own account    |
| Bucket `team-photos`: read                                                                                                         | empty list; no public URL (bucket private) | 0 objects                                        | read own team's                         | read                                        | 0 objects               | 0 objects      |
| Bucket: upload / delete                                                                                                            | refused                                    | refused                                          | refused                                 | own team's folder, one level, ≤ 150         | refused                 | refused        |
| Bucket: update / overwrite                                                                                                         | refused (no policy for anyone)             | refused                                          | refused                                 | refused                                     | refused                 | refused        |

Checked specifically, and correct:

- **`using` without `with check`**: there are no UPDATE policies anywhere, so there is nothing to
  slip through; the INSERT policy on storage has `with check`.
- **`SECURITY DEFINER`**: all 12 RPCs and the 5 policy helpers set `search_path = ''`, check
  `auth.uid()` / the caller's role on the same team id they write, and are not executable by
  `anon` or `public`. `rls_auto_enable()` (Supabase's own) is executable by everyone but can't be
  called (it is an event-trigger function; the API answers 400).
- **Invite codes**: 50 bits from `gen_random_bytes`; guessing isn't practical. Expiry is checked
  on the server (`expires_at > now()`), capped by a CHECK (30 days; manager codes 7 days and one
  use, enforced with `FOR UPDATE`). Revoked and used-up codes are refused. → reuse after a
  demotion or removal is the hole (**H1**).
- **A user changing their own role**: only through `set_member_role` (managers), and the
  last-manager trigger stops the last one — except through an invite code (**H1**).
- **The last manager** can't leave, be demoted, be removed or delete their account while other
  members remain (trigger + team-row lock; also blocks deleting the user in the dashboard).
- **Keep-alive table**: one row, `anon` SELECT only, no write path.
- **Print / PDF**: every name in the generated HTML is escaped (`escapeHtml`), so a manager can't
  inject script into other members' print view (hardening idea: L4).

---

## Findings

Each finding: where, why it happens, the exact fix. Status is filled in at the end ("Fix log").

### CRITICAL

None.

### HIGH

#### H1 — Invite codes outlive the access of the people who know them

- **Where**: `supabase/migrations/20261125090200_v10_invites.sql` (`create_invite` l. 55–91,
  `join_team` l. 113–149); `20261125090000_v10_teams_members.sql` (`set_member_role` l. 243–256,
  `remove_member` l. 261–279).
- **What happens** (both reproduced on the live database in a rolled-back transaction):
  1. _A demoted manager makes themselves manager again._ Managers see every invite code
     (`invites_select_managers`) and can create one. Manager A makes manager B a player. B calls
     `join_team` with any unused manager code (one B noted, or created a minute earlier):
     `join_team` upgrades an existing member (`set role = 'manager'`). Result: `{"role":
"manager"}`. B can then remove A's co-managers or delete the team.
  2. _A removed member comes back with a second account._ `join_team` refuses a removed user
     only for the same user id (`private.team_removals`). Any code still valid (player codes
     work many times, up to 30 days) lets a second account — another email address — join.
     Result: `{"role": "player"}`, and the team's records and photos are readable again. A
     removed manager knows the open manager codes too and comes back as manager.
  3. The role is checked _before_ the team-row lock in `set_member_role`, `remove_member` and
     not under any lock in `create_invite`: a call that waits behind the caller's own demotion
     still runs with the old role (e.g. creates a fresh manager code, or promotes a friend).
- **Why**: codes are bearer secrets with their own lifetime; nothing ties them to the membership
  changes of the people who have seen them.
- **Fix** (new migration `20261126120000_v10_audit_invite_revocation.sql`):
  - trigger `team_members_revoke_invites` (`private.revoke_manager_invites()`): whenever someone
    stops being a manager of a team (made a player, removed, left, account deleted), the team's
    open manager codes are revoked;
  - `remove_member` revokes **every** open code of the team (the managers create new ones for
    people who haven't joined yet);
  - `create_invite`, `set_member_role` and `remove_member` take the team-row lock and check the
    role again.
  - App: the "Remove member" question says that open invite codes stop working (EN + DE).
  - Tests: `supabase/tests/rls.sql` T31–T33.

#### H2 — A used-up manager code is still listed as an active invite

- **Where**: `src/lib/sync/supabaseBackend.ts:62–78` (`inviteRow`, `toInvite`), `:243`
  (`select('id, code, role, expires_at, revoked_at, uses')`); `src/lib/sync/types.ts:28–36`
  (`Invite` has no `maxUses`); `src/domain/invites.ts:71–76` (`activeInvites`);
  `src/features/members/InviteRow.tsx`.
- **What happens**: the database makes manager codes single use (`max_uses = 1`, added after the
  security review). The app never reads `max_uses`, so after the invited manager joined, the
  code stays in the manager's "Invites" list ("Manager · valid until … · used 1×") with Share and
  Copy. Shared again, it answers "This code is invalid or expired". It also keeps counting
  towards nothing on the server but looks like one of the 20 slots to the user.
- **Why**: worker A changed the contract (single use); worker D's adapter and list were written
  against the earlier one.
- **Fix**: read `max_uses` (`listInvites` select and `create_invite`'s result), add
  `maxUses: number | null` to `Invite`, and make `activeInvites` leave out invites with
  `uses >= maxUses`. Tests: `invites.test.ts`, `supabaseBackend.test.ts`, the fake backend.

#### H3 — A photo that failed to download is wiped for the whole team after an app restart

- **Where**: `src/store/photoStore.ts:98–102` (`pendingRemotePhotos`, in memory), `:118–126`
  (`prunePhotos` clears a `photoId` whose photo is missing); `src/lib/sync/photoSync.ts:41–91`
  (the list is only filled during a download attempt); `src/lib/sync/engine.ts:76`
  (`pendingPhotos`, in memory).
- **What happens** (reproduced: `src/lib/sync/__tests__/photoRestart.test.ts` fails on
  `2af66a8`): a pulled player or team record points at a photo; the download fails for a reason
  other than "offline" (device storage full — AsyncStorage's 6 MB on Android, 5 MB in a browser
  —, a storage error, a bad blob). The record is applied anyway and the photo id is protected by
  an in-memory list. After the next app start the list is empty, `prunePhotos()` runs at
  hydration and clears the `photoId`. On a **manager** device that is a local change: it is
  stamped "now", pushed, and wins on every device; the photo-cleanup then deletes the picture
  from the cloud folder. One device with full storage removes pictures for everyone. On a viewer
  device the picture is never downloaded again.
- **Why**: DECISIONS #285 ("a failed download is retried and doesn't clear the picture") holds
  only within one app run; the protection isn't derived from stored state.
- **Fix**: derive it from the persisted sync state. `sync.teams[teamId].photos` already lists
  the photo ids the team's cloud folder has (stored with the records in one write):
  - `prunePhotos` never clears a `photoId` that a shared team's `photos` list contains;
  - `pullTeam` also downloads photos the team's records refer to that the cloud has and the
    device lacks (so the retry survives a restart).
    A photo id the cloud never had (a local save that failed) is still cleared as before.

#### H4 — A pull that needs several pages can skip a record for good

- **Where**: `src/lib/sync/teamSync.ts:127–151` (`serverNow = page.serverNow` is overwritten per
  page; `nextCursor(…, rows, serverNow)`); rule in `src/domain/syncMerge.ts:434–453` and
  `docs/SUPABASE.md` ("Pull cursor").
- **What happens** (reproduced: `src/lib/sync/__tests__/pullCursor.test.ts` fails on `2af66a8`):
  the cursor may only pass rows written more than 10 s before the server time _of the read that
  returned them_, because a concurrent push that hasn't committed yet may hold a lower version.
  With more than 500 new rows the engine reads several pages and uses the **last** page's
  server time for all of them. If the later pages take longer than 2 s (large pages on a mobile
  connection), page-1 rows that were only seconds old at their read count as "old enough", the
  cursor passes them, and a row that committed in between (two managers pushing at the same
  moment, e.g. during a match, while someone downloads the team) is never pulled. That device
  keeps the stale record; if it is a manager's and they edit it, the missed change is
  overwritten for everyone.
- **Why**: paging was added in the engine; the cursor rule was written for a single read.
- **Fix**: keep the **first** page's server time for the cursor (every later page is read later,
  so the first one is the safe bound for all rows). One line in `pullTeam`, plus the test.

### MEDIUM (not fixed; exact fix given)

- **M1 — Take over: the previous scorer can still overwrite the new one once.** `holdCommands.ts`,
  `engine.ts` cycle order (pull → push → holds). The old device learns about the take-over only
  at the end of its next cycle; a rally it scores before that is pushed with a later time and
  replaces the whole set, including rallies the new scorer added. Advisory by design (DECISIONS
  #277, #288). Fix: read the holds _before_ pushing and don't push sets of a match another
  device holds (merge the pulled set instead and tell the user).
- **M2 — A device whose clock runs ahead wins every conflict it has unsynced changes for.**
  `syncChanges.ts:64–69` stamps with the device clock; the server clamps to +1 min
  (`stamp_team_record`), but the local merge compares the unclamped time
  (`syncMerge.ts:205`). Sequential edits are handled (a refused push on a known version is
  re-stamped, `syncMerge.ts:398–406`); real conflicts aren't. Fix: estimate the clock offset from
  `pull_changes`' `server_now` and stamp edits in server time.
- **M3 — Pushed records aren't checked against the limits pulled records must meet.**
  `syncSchema.ts:83–97` rejects names over 200 and other text over 1000 characters on pull;
  `teamSync.ts` pushes whatever is local (only the opponent picker has a `maxLength`). A team or
  player with an over-long name syncs to nobody (a "records skipped" notice elsewhere); if it is
  the team record, the team can't be downloaded at all. Fix: run `parsePayload` on changes before
  pushing and skip + report failures, and add `maxLength` to the name fields.
- **M4 — One record the server refuses blocks the team's whole push.** `push_records` raises for
  the whole batch (id over 200 characters — possible for opponents upgraded from old data with
  long non-Latin names, `seasonUpgrade.ts:13`; a NUL character; a payload over 64 kB), and
  `pushTeam` stops at the first failing batch every cycle, with only "Something went wrong".
  Fix: on `23514` / `22023` / `22P05` retry the batch record by record, skip and report the bad
  ones.
- **M5 — Slow uplinks never finish a push.** `fetchWithTimeout.ts` aborts after 15 s;
  `PUSH_LIMITS` allows 512 kB per batch and photos are up to 256 kB. Below ~35 kB/s every retry
  times out the same way. Fix: halve the batch after a timeout (down to one record) and give
  uploads a longer timeout.
- **M6 — A linked team whose team record never arrives is pulled from 0 every cycle.**
  `teamSync.ts:151` (the cursor doesn't move while the team isn't there). Costs egress every
  60 s for as long as the record is invalid. Fix: back off (e.g. once per app start) and show a
  notice.
- **M7 — Rejoining as a player replaces an old local copy without asking.**
  `teamCommands.ts:46–62`: a team that was unlinked (removed member, account switch) and edited
  locally since is reset to the cloud's content when the same team is joined or downloaded again
  as a player. Fix: keep the old copy under a new id (`rekeyTeam`) when it has local changes.
- **M8 — Sign-in emails can be requested for any address by anyone with the publishable key.**
  Not a code bug: it is how email OTP works. With the owner's Gmail (about 500 a day) the auth
  rate limit is the only brake. See "Owner dashboard steps" (keep "emails per hour" at 20 or
  less; consider a CAPTCHA).
- **M9 — `delete_team` checks the role before it locks the team row** (the same race as H1 item
  3, without a way to gain anything: the caller could have deleted the team a moment earlier).
  Fix: lock, then check, as in the H1 migration.
- **M10 — Known limit kept from v10 (DECISIONS #285)**: an older edit that brings back a photo id
  another manager already deleted leaves a dangling picture until someone sets a new one.

### LOW / CLEANUP (not fixed)

- **L1** Default privileges for tables created by `postgres` in `public` still give `anon`,
  `authenticated` and `service_role` TRUNCATE / REFERENCES / TRIGGER / MAINTAIN; the migrations
  revoke them per table (`service_role` keeps them — unused, there is no service key anywhere).
  A future migration that forgets `revoke all` would expose them. Fix: `alter default privileges
for role postgres in schema public revoke all on tables from anon, authenticated, service_role`.
- **L2** `public.rls_auto_enable()` (Supabase's) is executable by everyone; harmless, clears two
  advisor warnings when revoked (owner step in `docs/SUPABASE.md`).
- **L3** `create_team` tells a stranger whether a team id exists (`taken`). Ids are random UUIDs.
- **L4** The print iframe (`src/lib/print.web.ts`) has no `sandbox` attribute; all text is
  escaped, a sandbox would be a second line of defence.
- **L5** Any `TypeError` inside the sync code counts as "offline" (`errors.ts` `OFFLINE_NAMES`),
  which hides programming errors behind the offline badge.
- **L6** Rows that fail validation are skipped for good once the cursor has passed them, also
  after an app update that would accept them. A future schema change should reset cursors.
- **L7** A manager can push a tombstone for the `team` record (clients ignore it, new downloads
  of the team then wait until a manager edits the team). The app never does; only a hostile
  manager could, and they can delete the team anyway.
- **L8** Any manager can remove the team's creator or delete the team (managers are equals by
  design). Worth a line in the user guide.
- **L9** Member display names and live-hold names are free text chosen by the member.
- **L10** After an account is deleted, its user id stays as `owner_id` on photos it uploaded to
  teams that still exist (a random id, no name or email).
- **L11** A single-use manager code entered a second time (a double submit) answers "invalid
  code" although the first join worked.
- **L12** A browser tab left open polls every 60 s (three small requests). Fine for a few users;
  with many always-open tabs it eats into the 5 GB egress of the free tier.
- **L13** `docs/SUPABASE.md` lists a "Leaked Password Protection Disabled" advisor warning that
  the advisor no longer reports.
- **L14** The 6-digit email code relies on Supabase's per-IP limits against guessing (no
  per-account lockout). An 8-digit code is a dashboard setting plus a constant in the app.

---

## Checked and found correct

- **Access control**: see the table above. The RLS script passes on the live project.
- **Last write wins with wrong clocks**: a refused push on a version the device already knew is
  re-stamped just after the server's time and wins on the next push (`applyPushResults`), so a
  slow clock doesn't lose edits made on top of the latest version; future times are clamped on
  the server. Remaining gap: M2.
- **Tombstones**: kept forever on the server; a deletion wins over an older edit and loses to a
  newer one; a deleted parent with newer children comes back; old local copies linked to an
  existing cloud team are stamped "epoch" so the cloud's deletions win.
- **Partial uploads**: each push batch is one server transaction; parents are pushed before
  children; a match travels with its sets; a lost answer is repeated safely (same time and
  device → "not applied", same content).
- **Double submits**: commands run one after another (`engine.exclusive`); a second upload of
  the same team answers `linked`.
- **Two devices, same match**: match data and each set are separate records; the same set is
  last-write-wins (documented), which the live hold prevents in normal use.
- **First sign-in**: nothing uploads without a tap; a taken id is re-keyed locally.
- **Demotion**: unsynced changes are undone with a notice and the team is reset to the cloud's
  content, also after a restart.
- **Account deletion**: blocked for the last manager; photos first, then the team rows and the
  user in one transaction; local data stays.
- **A team deleted locally** is unlinked, never deleted on the server; a team deleted on the
  server is unlinked on every device with a notice, local copies stay.
- **Malformed server data**: rows go through zod (`parseRemoteRow`), answers of every RPC and
  table read through a schema (`supabaseBackend.ts`); a bad `server_now` leaves the cursor where
  it is.
- **Paused project / server down / timeout**: counted as offline with a growing retry delay; a
  dead session shows "Sign in again"; nothing is thrown to a screen from the engine.

---

## Side audits

_Pending: existing users and backups; privacy, secrets and leftovers; screen resilience and
view-only gating._

---

## Open questions (owner decisions)

1. **H1 revokes all open invite codes when a member is removed.** That is the safe default (a
   code works for any account), but a manager who removes someone has to create and send new
   codes to people who haven't joined yet. Alternative: revoke only codes older than the removed
   member's joining date. Decided here: revoke all (DECISIONS #292). Say so if you prefer the
   alternative.
2. **CAPTCHA on sign-in** (M8): Supabase supports Turnstile / hCaptcha for the email code. It
   needs a small app change and a third-party script on the web version. Wanted?
3. **8-digit codes** (L14) instead of 6: wanted?
4. **Take over** (M1): should the app stop the previous scorer's device from pushing as soon as
   it sees the take-over (a behaviour change in live mode)?

## Owner dashboard steps

See the end of this file (updated after the fixes).
