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

| Severity      | Count | Fixed in this audit            |
| ------------- | ----- | ------------------------------ |
| CRITICAL      | 1     | yes (see "Fix log" at the end) |
| HIGH          | 10    | all 10                         |
| MEDIUM        | 19    | none; M1 and M13 afterwards    |
| LOW / CLEANUP | 33    | none                           |

H1–H4 come from the lead audit, C1 and H5–H10 from the side audits (each checked against the code by the
lead auditor before it was listed).

Short version: the database's access rules are sound — a stranger, a signed-out caller, a player,
a manager of another team and a removed member are all kept out, and the live database is
exactly what the migration files say. The four HIGH findings are: invite codes that outlive the
access of the people who know them (**H1**, a real way back in for a demoted manager or a removed
member), used-up manager codes shown as usable (**H2**), a photo that can be wiped for the whole
team after one device's failed download (**H3**), and a pull cursor that can skip a record
(**H4**). The side audits added: a manager invite option that always fails (**H5**), duplicate
jersey numbers from two devices that silently make the backup file unloadable (**H6**), a paused
project signing every device out (**H7**), a promoted viewer pushing an out-of-date copy to
everyone (**H8**), a Merge import that can empty a shared team (**H9**), an import that can undo a sync that
happens while it runs (**H10**) — and the one CRITICAL: after the linked profile is deleted, its
shared teams stay linked, and restoring a backup then deletes cloud records for every member
(**C1**).

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

#### C1 — Deleting the linked profile leaves its shared teams linked; restoring a backup then deletes cloud records for everyone

- **Where**: `src/store/appStore.ts:79–93` (`deleteProfile` removes the teams and clears only
  `sync.account`; `sync.teams[…]` stays), `:103–110` (`deleteTeam`), `:227–244` (`replaceAll`);
  `src/lib/sync/teamSync.ts:54–55, 121–124` (a team that is gone is only unlinked inside
  `pullTeam`, which needs a session); `src/domain/syncImport.ts:29–34` and
  `src/features/settings/useImport.ts:73, 92` (`sharedTeamsOf` trusts every link);
  `src/store/syncState.test.ts:84–93` asserts the leftover link as intended.
- **What happens** (reproduced by the side audit with the engine and the fake cloud, Merge and
  Replace):
  1. A manager's device has shared team T, fully synced.
  2. They delete the linked profile (the confirm says: you'll be signed out, shared teams stay
     in the cloud). The device is signed out now, so no sync cycle ever drops T's link.
  3. To get their teams back they import a backup that contains T. T is rebuilt under the stale
     link, next to its old `base` (what the server had) and cursor.
  4. They sign in again with the same account. `detectChanges` sees every record the backup
     lacks as deleted and every other difference as an edit made now.
  5. The push deletes everything created since the backup and overwrites the rest — on every
     member's device.
- **Why**: DECISIONS #259 ("a team that disappears locally is unlinked, never deleted on the
  server") is implemented lazily in the pull; the design (§3.10) assumed "detection unlinks
  them", but without a session nothing runs.
- **Fix**: unlink at once, in the same store write: `deleteProfile`, `deleteTeam` and
  `replaceAll` drop the links of the teams they remove. Devices that already hold such a link
  (10.0.0) drop it when the engine starts and whenever it notes changes (no session needed).
  `sharedTeamsOf` ignores links whose team isn't on the device. Tests: store, engine scenario
  (the steps above), import.

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

#### H5 — "Manager · 30 days" in New invite always fails

- **Where**: `src/domain/invites.ts:18` (`INVITE_DAYS = [1, 7, 30]` for both roles),
  `src/features/members/NewInviteDialog.tsx:53–62`; server: `create_invite` allows manager codes
  1–7 days only (`20261125090200_v10_invites.sql:64–67`, SQLSTATE `22023` → `unknown`).
- **What happens**: a manager picks role Manager and 30 days and gets "Something went wrong. Try
  again." every time. `members.test.tsx:204–217` asserts exactly this call against the mock.
- **Why**: the 7-day cap for manager codes came from the security review (worker A, DECISIONS
  #271) after the dialog (worker D) was written.
- **Fix**: `inviteDayOptions(role)` in `src/domain/invites.ts` (manager: 1 and 7 days), the
  dialog shows only those and falls back to 7 when the role changes; correct the test.

#### H6 — Duplicate jersey numbers from two devices make the backup file unloadable, silently

- **Where**: `src/domain/syncRepair.ts:5–10, 294–295` reports `duplicateNumber` in
  `MergeOutput.issues` (`syncMerge.ts:66–67, 258`); `src/lib/sync/teamSync.ts:98–110, 147–150`
  never reads `issues`; no screen mentions duplicates. The design promised "a roster warning and
  an export warning" (`docs/V10_SYNC_DESIGN.md` §0 hazard 7; DECISIONS #275 "reported").
- **What happens**: two managers (or one manager on two devices) each add a player with number
  7 before syncing. Both players stay — by design. But a backup made on any device of that team
  is then refused on import (`exportConsistency.ts:66–67` → `INCONSISTENT_REFERENCES`), in
  Replace and in Merge. Nobody is told until they need the backup.
- **Why**: worker B reported the issue in the merge result; the engine and the UI workers never
  picked it up.
- **Fix**: derive it from the store (it must also show after a restart): a warning on the Roster
  tab naming the numbers, and a warning in Settings → Export naming the team, both EN + DE,
  based on one pure helper `duplicateNumbers(players)`.

#### H7 — A paused project signs every device out

- **Where**: `src/lib/sync/client.ts:29–41` (auth-js gets the plain `fetchWithTimeout`);
  auth-js 2.x `lib/fetch.js` (`NETWORK_ERROR_CODES` = 500–504, 520–530) and
  `GoTrueClient._callRefreshToken` (any other error on a refresh removes the session).
- **What happens**: a paused Supabase project answers HTTP 540. A device whose access token has
  expired (anyone who opens the app more than an hour after last use) tries to refresh it, gets
  540, and auth-js deletes the stored session and fires `SIGNED_OUT`. After the owner restores
  the project, every such user must sign in again: one email each through the owner's Gmail. A
  429 on the refresh does the same. Unsynced changes survive. This contradicts
  `docs/SUPABASE.md` ("If the project paused anyway, the app shows Offline … devices sync again
  on their next cycle"). Reproduced by the side audit with the real supabase-js and a fake
  `fetch` (540 JSON, 540 HTML, 429: session removed; network error, 500, 503: kept). Not checked
  against a really paused project.
- **Why**: auth-js only treats a fixed list of statuses as temporary.
- **Fix**: wrap the client's `fetch`: for `/auth/v1/` requests, an HTTP status ≥ 500, and a 429
  on a token refresh, become a thrown network error — the one thing auth-js always treats as
  temporary (session kept, retried later).

#### H8 — A promoted viewer pushes its out-of-date copy to everyone

- **Where**: `src/lib/sync/engine.ts:396–402` (a demotion resets the team to the cloud's copy; a
  promotion only stores the new role).
- **What happens**: a viewer's local copy can differ from the cloud without any way to heal
  (H3's prune, H9's import, local repairs, a dialog left open across a demotion): pulls only
  deliver rows newer than the cursor. When a manager makes that member a manager,
  `detectChanges` sees every difference as an edit made "now" and pushes it — missing records
  as deletions. Reproduced by the side audit: a viewer copy with 0 players / matches / presets
  empties the team on the other device after the promotion.
- **Why**: promotions were treated as harmless; demotions got the reset.
- **Fix**: a promotion first replaces the local copy with the cloud's (the same reset pull as a
  demotion), and only then stores the manager role. The stored role stays `player` with cursor
  0 until that pull worked, so it also holds across a restart or an offline period.

#### H9 — A Merge import can empty a shared team

- **Where**: `src/domain/syncImport.ts:59–69` (shared teams are protected by **team id** only);
  `src/domain/exportMerge.ts:28–33, 81–105` (the file wins per record id);
  `src/domain/syncUpload.ts:24–41` (`rekeyTeam` keeps the ids of players, seasons, matches and
  presets).
- **What happens**: a team got a new id when it was uploaded (its id was taken — e.g. the same
  backup was shared between two coaches before v10, or the team was uploaded under another
  account first). The user later merges an older backup of it, or a co-coach's export: the file
  has the same record ids under the old team id. Merge moves every player, season, opponent,
  match and preset to the old team id. The shared team is empty on this device; a manager
  device then queues deletions for all of it and the team is wiped for every member (the data
  survives on the importing device under the old id). Reproduced by the side audit with the
  golden export. Replace is safe.
- **Why**: `importWithSharedTeams` checks which teams the file contains, not which records.
- **Fix**: refuse the import (the existing "clashes with a shared team" message) when a record
  in the file has the id of a record of a shared team but belongs to another team. Pure domain
  check + tests.

#### H10 — An import can undo a sync that happens while it runs

- **Where**: `src/features/settings/useImport.ts:91–106`: `await transferSnapshot()` → compute →
  `await replacePhotos / putPhotos` (writes every photo) → `store.replaceAll(result.data)`;
  `replaceAll` keeps `sync` (`appStore.ts:240–243`).
- **What happens** (reproduced by the side audit with a fixed interleaving, both modes): while
  the photos are written, a sync cycle applies another manager's new record and notes it in
  `base`. `replaceAll` then writes data computed from the older snapshot: the new record is gone
  locally but known in `base`, so it is deleted for everyone, and changed records go back to
  their older content. The file doesn't need to contain the shared team. The window is the
  photo write, so it grows with the number of photos.
- **Why**: two awaits between reading the data and writing it back.
- **Fix**: write the photos first, then read the data, compute and `replaceAll` without waiting
  in between.

### MEDIUM (not fixed; exact fix given)

- **M1 — Take over: the previous scorer can still overwrite the new one once.** `holdCommands.ts`,
  `engine.ts` cycle order (pull → push → holds). The old device learns about the take-over only
  at the end of its next cycle; a rally it scores before that is pushed with a later time and
  replaces the whole set, including rallies the new scorer added. Advisory by design (DECISIONS
  #277, #288). Fix: read the holds _before_ pushing and don't push sets of a match another
  device holds (merge the pulled set instead and tell the user).
  **Fixed afterwards** on the owner's decision: see "Follow-ups" at the end.
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

- **M11 — Offline with an expired token reads "Sign in first" instead of "Offline".**
  `supabaseBackend.ts:142–144`: `memberships()` ignores the error of `getSession()` and throws
  `notSignedIn`. Fix: `if (auth.error) throw backendError(auth.error)`.
- **M12 — The 15 s timeout ends when the response headers arrive.** `fetchWithTimeout.ts:17–21`
  clears the timer in `finally`; a body that stalls afterwards blocks the sync queue for good
  on web ("Syncing…", Sync now disabled, the shared-team delete dialog can't be closed). Fix:
  keep the timer until the body is read.
- **M13 — Sign-in asks for more emails than needed.** The code step is component state only
  (`useSignIn.ts:26–32`, `useResendTimer.ts`): if the screen closes or the app is killed while
  the user reads the email, the only way on is "Send code" again. "Change email" has no
  cool-down. A failed send by the mail server (HTTP 500, e.g. the Gmail quota is used up) reads
  "No connection"; `signup_disabled`, `email_address_invalid` and similar read "Something went
  wrong". Fix: remember `{email, sentAt}` and reopen at the code step (or add "I already have a
  code"); own texts for those codes.
  **"I already have a code" added afterwards** on the owner's decision (see "Follow-ups" at the
  end); the own error texts are still open.
- **M14 — Join, Cloud sync, the Profile card and Sign-in don't wait for the stored session.**
  (`JoinScreen.tsx:46`, `AccountScreen.tsx:38`, `profile/AccountSection.tsx:30`.) On a cold
  start they say "Sign in first" until the session is read, which invites a needless code
  request. Members and live already wait (DECISIONS #289). Fix: treat "restoring with a linked
  account" as loading.
- **M15 — The live hold doesn't cover deleting.** Delete match (`SeasonMatches.tsx:37, 89–93`),
  season, player and team check the role only, not `useMatchAccess`; holds are unknown from app
  start until the first cycle ends. Related to M1. Fix: gate the delete actions on unexpired
  holds.
- **M16 — The three screens map error codes to text separately** (`i18n/*/account.ts`,
  `members.ts`, `sync.ts` + `syncErrorText.ts`); `tooMany` reads "Too many at once. Try again
  with fewer." on the account screens although it means 10 teams / team full. `UploadPanel`
  drops the per-team reason. Fix: one shared map.
- **M17 — A sign-in can end with another account's session and no link.** If the sign-in screen
  closes during verify or on the "switch account" question, the new session stays, the old
  account's teams silently stop syncing and the UI says "Sign in". Fix: at start, sign out when
  the session's user differs from the linked account and that account still has teams.

- **M18 — A photo the cloud answers "not found" for is still cleared after a restart** (the rest
  of H3, DECISIONS #285's known limit): `teamSync.ts` removes such ids from `meta.photos`, so
  the prune's new check doesn't cover them; a manager device then pushes "no photo" and a
  device that still had the picture drops it. Fix: keep the id listed and let the prune clear a
  shared team's `photoId` only when that record has a local, unsynced change.
- **M19 — Every sync cycle rewrites the whole stored data three times, also when nothing
  changed.** `storeOps.ts:22–33` returns the same state for "no change", but zustand's persist
  writes after every `set`. About 1 + 2 × teams writes of the full blob per minute in the
  foreground. Fix: in `transaction`, compute the result first and don't call the store when it
  is the same object.

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

- **L15** A 401 `PGRST301` / `PGRST303` reads "You were signed out" although the session is
  fine (a device clock more than ~90 s slow gets it every hour). Fix: refresh and retry once.
- **L16** `errors.ts:92–93`: the 401 / 403 test runs before the "token has expired or is invalid"
  test (only matters for an old auth server without error codes).
- **L17** A refused hold with a null `held_until` never expires locally (`supabaseBackend.ts:316`
  → `''`, NaN compare in `syncAccess.ts:37`) until the next sync.
- **L18** Dialogs that were open survive a demotion (`PresetsTab.tsx:113–139` name dialogs; the
  delete confirms don't re-check the role).
- **L19** `/team/<id>/members?shareError=__proto__` crashes that screen (`ShareTeam.tsx:15–17`,
  `in` accepts prototype keys). Fix: `Object.hasOwn`.
- **L20** `runCycle` has no try / finally (`engine.ts:267–281`): a throw in `noteAll` would leave
  the cycle promise rejected for the session. No trigger found.
- **L21** German: "1 Änderung werden …" (`de/account.ts:74–75`, `:26–31`).
- **L22** A cloud team without a team record yet shows an empty name in the Download list and in
  the delete-account list (`useDeleteAccount.ts:25`).
- **L23** After a lost session the Cloud sync screen shows the plain signed-out panel;
  "You were signed out" isn't shown there.
- **L24** The notice kind `deleted` is defined and translated but never sent; "deleted for
  everyone" reads "You're no longer a member".
- **L25** The ESLint backend rule misses `require()`, dynamic `import()`, `./sync/engine` from a
  sibling in `src/lib`, test files and `scripts/`; it ignores `supabase/functions/*`, which
  never existed. No violation today.
- **L26** `photoId` is used as a storage path segment without a format check
  (`supabaseBackend.ts:327, 335, 356`). A co-manager's crafted id `../<other team>/<id>` makes a
  member's device fetch a photo from another team **that member already belongs to**; nothing
  goes back to the sender. Fix: allow `^[A-Za-z0-9_-]{1,100}$` only.
- **L27** Docs: `CLAUDE.md` still says "No backend"; `docs/HANDOFF.md` §3 says store version 11;
  `docs/SUPABASE.md` and the design mention `src/lib/sync/database.types.ts`, which doesn't
  exist; `docs/SUPABASE.md` says "profile data never leave the device" although the profile
  **name** is sent as the member's display name (the README says it correctly); the tour's
  Settings tip says "Everything stays on this device"; several file / function names in
  `docs/V10_SYNC_DESIGN.md` §4 differ from the code.
- **L28** `.gitignore` ignores `.env*.local` only; `app.config.js` / `config.ts` accept any key
  from `EXPO_PUBLIC_SUPABASE_KEY`, also a secret one (it would be bundled). Fix: ignore `.env*`
  and refuse keys starting with `sb_secret_` / JWTs with `service_role`.
- **L29** `.claude/settings.json` pre-allows every Supabase connector tool for agents working in
  this (public) repository, including `apply_migration`. Deliberate (HANDOFF §6); narrowing it
  to the read tools is safer.
- **L30** Cleanup: `teamMeta` (`storeOps.ts:94`) has no callers; `TeamList.tsx:38–50` checks the
  role inline instead of `useTeamAccess`; `ci.yml:45–46` hashes a `babel.config.js` that doesn't
  exist; `scripts/screenshots.js` needs an undeclared `playwright`.

- **L31** A shared team's photo that is still waiting for its download blocks every import on
  that device (`exportMerge.ts:107` fails the consistency check on a `photoId` without a photo;
  Merge says "conflict", Replace is refused). The H3 fix keeps such ids across restarts, so this
  lasts until the download works. Fix: accept dangling photo ids of shared teams in the import's
  check.
- **L32** The `sync` slice isn't validated when the stored data is loaded (`appStore.ts:260–285`
  has no `merge`): a corrupted `sync` value (`null`, no `teams`) makes the Teams tab and
  "Delete all data" throw. No released version writes such a value. Fix: replace a malformed
  slice with the empty one; move `noteAll` inside the cycle's `try`.
- **L33** On phones the URL polyfill and supabase-js are loaded at app start for everyone
  (`client.ts:6, 9`; only the client instance is created lazily). Never run on Hermes (see
  HANDOFF); a start-up problem there would also hit users without an account. Fix: `require`
  both inside `getClient()`.

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
- **A team deleted locally** through the team list ("Remove from this device", Leave, Delete for
  everyone) is unlinked first, never deleted on the server; a team deleted on the server is
  unlinked on every device with a notice, local copies stay. (Deleting the whole **profile**
  does not unlink: C1.)
- **Malformed server data**: rows go through zod (`parseRemoteRow`), answers of every RPC and
  table read through a schema (`supabaseBackend.ts`); a bad `server_now` leaves the cursor where
  it is.
- **Server down / timeout**: counted as offline with a growing retry delay; a dead session shows
  "Sign in again"; nothing is thrown to a screen from the engine. (A **paused** project is the
  exception: H7.)

---

## Side audits

Three independent read-only agents; their findings are merged into the lists above (H5–H9,
M11–M17, L15–L30). What they checked and found correct:

**Privacy, secrets and leftovers**

- A spy on every backend call plus a dump of the fake cloud: the description text and key, the
  profile's id, colour and photo appear in no call; a description-only edit pushes nothing. The
  email goes only to sign-in. The profile **name** goes out as the member's display name (60
  characters), nothing else of the profile.
- A pulled or refused-push record can't set or clear a description or a profile photo.
- A photo id can't be shared between a profile and a player through the UI (every pick gets a
  new id).
- Team photos are only read through the authenticated storage API: no public or signed URLs.
- Secrets: the working tree and the full history (497 commits, all branches and pull-request
  refs) hold no service-role key, secret key, JWT, password, SMTP credential or `.env` file. The
  only key anywhere is the publishable key in `supabase/public-config.json`. The workflows use
  no secrets except `github.token` in the APK workflow, and echo nothing.
- The web bundle contains exactly the project URL and the publishable key, once each; no source
  maps, no test users, no mocks.
- No `console.*` in `src/` or `app/` outside tests; no `@supabase/*` import outside
  `src/lib/sync`; the Jest mock of `@/lib/sync` has the same 25 exports as the real barrel; no
  foundation stubs, orphan files, TODOs, `.only` / `.skip` or commented-out code in the 235
  files v10 changed. The two new dependencies are used.

**Screens, errors and view-only**

- Every command resolves through `attempt`; every error code has EN and DE text; no raw server
  text, code or stack reaches a screen. Offline, rate-limited and wrong-code read differently.
- No automatic resend; verifying never sends an email; a wrong code costs nothing.
- Route guards (player form, new season, new match, preset, starters, season, player detail)
  check the role and that the record belongs to the team in the URL. The builder, presets and
  starters are gated in the save itself; live controls, tagging, next-set setup and undo are
  hidden for viewers. View-only works signed out, offline and while the session is restored (it
  reads the stored role).
- Import skips view-only teams by id; Replace keeps shared teams (the gap is H9).
- Sign out, Log out, Leave and Delete account say what happens to local data and ask first.

**Existing users and backups**

- **A user who never signs in makes no network call.** Measured on a production web build with
  every non-local request blocked and counted: a fresh user (new profile, new team, every tab,
  the v10 screens opened without submitting) and a user upgraded from stored v12 data made 0
  requests, 0 `fetch` calls, opened no socket and started no timer; the supabase-js client was
  never created. The path: `SyncHost` → `startSync` → `boot()` returns when there is no
  account, no linked team and no stored session (`engine.ts:156–162`); screens call no command
  without a session. A signed-out device that still has a linked account creates the client at
  start (one token-refresh timer), as intended.
- **"Sees no change"** holds except for three new entry points that are there by design (PLAN
  §45): "Join a team" on the Teams tab, "Share" in the team header, the "Cloud sync" card on the
  Profile tab. On web, supabase-js is part of the start chunk (see L33 for phones).
- **Store v12 → v13** adds only the empty `sync` slice; all collections and device settings are
  byte-identical. The v1 → v13 chain ends in the right shape; odd v1–v12 inputs never throw. A
  stored version newer than the app is left untouched (as before v10).
- **Export**: a store with a full `sync` slice exports byte-identically to one without; no
  device id, user id, email, role, cursor or hash appears; `schemaVersion` stays 10; the golden
  files (v1–v9 and the v10 round trip) are unchanged and load.
- **"Delete all data"** clears the data and the sync state in one write. `sync.account` never
  points at a missing profile. Replace keeps a shared team that is on the device with its
  profile; a manager's copy in the file is merged, a viewer's skipped.
- Sign-out with local scope removes the stored session before the network call, so it works
  offline.

---

## Open questions (owner decisions)

**Answered by the owner on 2026-11-26** (DECISIONS #304): 1 keep "revoke all"; 2 no CAPTCHA, the
rate limit is enough; 3 six digits stay; 4 yes; 5 yes. Questions 4 and 5 were then built: see
"Follow-ups" at the end. Question 6 (the two checks) is still open.

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
5. **"I already have a code"** on the sign-in screen (M13): saves emails when the app was closed
   while the user looked for the code. Wanted?
6. **Two small things to do once** (see "After the fixes"): run `supabase/tests/rls.sql` in the SQL
   editor, and the next time you delete a user who belongs to a team in the dashboard
   (Authentication → Users), check that it works — the fix for that could only be tested on a
   local Postgres, not through the real dashboard.

## Owner dashboard steps

Nothing is broken without them; they lower risk.

1. **Authentication → Rate Limits**: keep "emails sent per hour" at **20 or less**. Sign-in codes
   go through your Gmail (about 500 a day); anyone can ask for a code for any address (M8), and
   the limit is the only brake: 20 an hour is at most 480 a day. Keep the sign-up / OTP / verify
   limits as they are.
2. **Authentication → Sign In / Providers**: anonymous sign-ins stay **off** (checked: off);
   Email stays the only provider (checked).
3. **Optional**, SQL editor:
   `revoke execute on function public.rls_auto_enable() from public, anon, authenticated;` —
   clears the two advisor warnings about Supabase's own helper (L2).
4. **Optional**: Authentication → Attack Protection → CAPTCHA, if you want it (open question 2;
   it needs an app change first — don't turn it on before that, or sign-in stops working).
5. **Nothing to do for the migration**: `20261126120000_v10_audit_invite_revocation.sql` is
   applied and recorded. If you ever set the project up again: apply all files in
   `supabase/migrations` in name order (`docs/SUPABASE.md`).
6. Still open from before the audit (HANDOFF): GitHub Pages isn't turned on; the keep-alive
   workflow must stay enabled (GitHub turns scheduled workflows off after 60 days without
   commits).

---

## Fix log

Branch `fix/v10-audit`, PR [Nick-ze/volley-lineup#96](https://github.com/Nick-ze/volley-lineup/pull/96).
The report was committed first (`66630b7`, side audits `d39cb15`, `2c7782f`), then one commit
per finding.

| Finding | Status | Commit               | Proof (tests)                                                                                                             |
| ------- | ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| C1      | fixed  | `3b55063`            | `staleLink.test.ts` (the five steps, Merge and Replace; a link left by 10.0.0), `syncAccess.test.ts`, `syncState.test.ts` |
| H1      | fixed  | `0680a6e`, `0527af6` | `supabase/tests/rls.sql` T31–T33 + T30 on the live project; `roles.test.ts` (fake cloud with the same rules)              |
| H2      | fixed  | `91e6f8b`            | `invites.test.ts`, `supabaseBackend.test.ts`, `members.test.tsx`                                                          |
| H3      | fixed  | `a0894de`            | `photoRestart.test.ts` (restart; refused push), `photos.test.ts` (domain)                                                 |
| H4      | fixed  | `5af0461`            | `pullCursor.test.ts`                                                                                                      |
| H5      | fixed  | `fcf2452`            | `invites.test.ts`, `members.test.tsx`                                                                                     |
| H6      | fixed  | `9c7926c`            | `roster.test.ts`, `duplicateNumbers.test.tsx`, `exportWarning.test.tsx`                                                   |
| H7      | fixed  | `fc727fd`            | `authFetch.test.ts` (the real supabase-js client, fake `fetch`: 540 JSON / HTML and 429 keep the session)                 |
| H8      | fixed  | `6062a19`            | `roles.test.ts` ("promotion of a view-only copy…", offline, manager code)                                                 |
| H9      | fixed  | `ef049a6`            | `syncImport.test.ts` (every record kind; Replace unchanged)                                                               |
| H10     | fixed  | `6dc0709`            | `importShared.test.tsx` ("a sync that lands while the import writes its photos")                                          |

Every test above fails on `2af66a8` (checked for each before the fix, or by putting the old code
back). Two existing tests were changed because they asserted the bug, with a comment in place:
`syncState.test.ts` (a link staying after its profile was deleted, C1) and `members.test.tsx`
("Manager · 30 days", H5). MEDIUM and LOW findings were left as listed. Folded into H1 because
they are the same hole: the role re-check under the lock in `set_member_role` / `remove_member`
(part of what M9 describes for `delete_team`, which is unchanged).

### Files changed

- **Database**: `supabase/migrations/20261126120000_v10_audit_invite_revocation.sql` and
  `20261126130000_v10_audit_member_triggers.sql` (new), `supabase/tests/rls.sql`.
- **Domain** (`src/domain/`): `syncAccess.ts`, `syncImport.ts`, `syncMerge.ts`, `invites.ts`,
  `photos.ts`, `roster.ts` and their tests.
- **Store**: `appStore.ts`, `photoStore.ts`, `syncState.test.ts`.
- **Sync** (`src/lib/sync/`): `engine.ts`, `teamSync.ts`, `teamCommands.ts`, `photoSync.ts`,
  `client.ts`, `authFetch.ts` (new), `supabaseBackend.ts`, `types.ts`, `__mocks__/index.ts`;
  `storeOps.ts`; tests `staleLink`, `photoRestart`, `pullCursor`, `authFetch`, `auditReview`
  (new), `roles`, `supabaseBackend`; `src/test-utils/fakeBackend.ts`.
- **Screens**: `features/members/NewInviteDialog.tsx`, `features/roster/components/RosterTab.tsx`,
  `features/settings/{useImport.ts,useExport.ts,ExportSection.tsx}` and tests
  (`members.test.tsx`, `duplicateNumbers.test.tsx`, `exportWarning.test.tsx`,
  `importShared.test.tsx`).
- **Texts** (EN + DE): `i18n/*/members.ts`, `roster.ts`, `transfer.ts`.
- **Docs**: this file, `docs/DECISIONS.md` (#292–#303), `docs/SUPABASE.md`, `docs/HANDOFF.md`.

About 55 files, 3 500 lines added (most of them tests and this report). No stored data shape
changed: store version 13, export schema 10, app version 10.0.0.

### Migrations applied

`20261126120000_v10_audit_invite_revocation.sql` and, after the review,
`20261126130000_v10_audit_member_triggers.sql` (three `alter function … security definer` and a
one-time revoke of older codes: see "After the fixes"). Both were applied to
`qzeergfqfwovcvdarwua` with the connector on 2026-11-26, each after the PR's checks were green,
and recorded under the file's version. The details below are for the first one.

- Before: the migration plus the whole test script (T1–T33) ran in one rolled-back transaction
  on the live project — `ALL RLS TESTS PASSED`, nothing left behind. `join_team`'s lock order
  was added after that run and dry-run on its own the same way.
- After: the five function bodies on the live database are identical to the file (md5), the
  trigger `team_members_revoke_invites` exists, the grants are unchanged (`authenticated` only
  for the RPCs, nobody for the trigger function). Security advisor: the same intended items as
  before (12 RPCs, `rls_auto_enable`, the `team_removals` INFO); performance advisor: no
  findings. The whole test script (T1–T33) is run once more on the migrated
  database; its result is in "After the fixes" below.
- Nothing was dropped; no row was changed. The project holds 0 users, teams, invites and
  objects (only the `keepalive` row), as before the audit.

### Test results

- `npm run check` (lint, format, typecheck, tests): green. **2255 tests in 175 suites** after the
  review's corrections (2239 in 174 before them, 2173 in 168 before the audit); `src/domain` at
  100 % statements, branches, functions and lines.
- `npx expo export -p web`: succeeds.
- CI on the PR: green (`test`, `lint · format · typecheck`, `web export`).
- Independent review of the fixes by two reviewer agents: see "After the fixes" below.

### After the fixes

**Post-migration test run.** `supabase/tests/rls.sql` (T1–T33) on the migrated live database:
`ALL RLS TESTS PASSED`, nothing left behind (0 users, teams, records, invites, objects). The
text that reached the database was compared with the file through the database's statement
log: identical. (The script takes about 40 s, mostly the 20 000-row limit test; the connector's
call limit is 230 s.) After the second migration (`20261126130000`) the new T30
checks were confirmed on the live schema directly (the three AFTER triggers run as their owner,
`join_team` locks the team first, no trigger function is executable by an API role); the full script
was then run once more (result: see "Last run" at the end of this section).

**Independent review.** Two reviewer agents that had not written the code looked at the fixes:
one at the database migration and the outage wrapper (with a local Postgres, two-session tests
and a pgbench stress mix of all RPCs), one at the app code (with its own scratch tests). Neither
found a blocker. What they found, and what was done:

| Review finding                                                                                                                                                                                                                                                                                                                       | Done                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| H8: a promotion never completed while one row's id belonged to another local team, and pulled from 0 every cycle                                                                                                                                                                                                                     | fixed (`42e6854`): no longer waits on such rows; armed once per app run                                                                             |
| H8: after the reset pull the bookkeeping still held entries the pull hadn't confirmed (a viewer that adopted an old copy; a row the device can't read)                                                                                                                                                                               | fixed (`42e6854`): `resetToCloudMerge` leaves `base` exactly matching the device (`syncMerge.test.ts` "leaves nothing to push")                     |
| H3: the refused-push branch listed a photo also when the newer row lost locally; the clean-up could then remove a photo the server's row points at                                                                                                                                                                                   | fixed (`42e6854`): listed only when the merged team refers to it                                                                                    |
| H10: a change of the data during the photo write could still make the prune drop the file's pictures; a refused import could overwrite a same-id picture                                                                                                                                                                             | fixed (`42e6854`): compute first, photos into memory and `replaceAll` in one step                                                                   |
| C1: a link that hasn't pulled yet (a download under way) still adopted a team an import brings under its id                                                                                                                                                                                                                          | fixed (`42e6854`): such a link is dropped by `replaceAll`                                                                                           |
| C1: links removed by the store left pending photos / reset / holds in memory                                                                                                                                                                                                                                                         | fixed (`42e6854`)                                                                                                                                   |
| H1: codes that had outlived a demotion or removal made **before** the migration stayed valid                                                                                                                                                                                                                                         | fixed (`4a9b2a6`, migration `20261126130000`): revoked once. The hosted project had no invites                                                      |
| The AFTER triggers on `team_members` run as the role that deleted the auth user: deleting a team member in the dashboard fails (also on 10.0.0)                                                                                                                                                                                      | fixed (`4a9b2a6`, migration `20261126130000`): the three functions are `security definer`. Not tried through the real dashboard (no user to delete) |
| H1 before `0527af6`: `join_team` locked the invite before the team — 84 deadlocks in 63 000 mixed calls on the reviewer's bench                                                                                                                                                                                                      | already fixed by `0527af6`: 0 in 248 000 (the base schema had 21 in 95 000)                                                                         |
| Nits: the revoking statements skip a code that expires in the same instant; `join_team` locks the team row for a revoked code too; `delete_team` checks the role before the lock (M9); "Two players have number 7" also for three; the export warning shows for a single clean team; a failing photo download is retried every cycle | left; listed here                                                                                                                                   |

New tests for these: `auditReview.test.ts` (8 cases), `syncMerge.test.ts` (5 cases),
`importShared.test.tsx` (3 cases), `rls.sql` T30 (the member triggers).

**Verified by the reviewers** (not repeated above): the migration closes all three parts of H1
in two-session runs (the old schema lets the demoted manager back in, the new one answers
`42501` / `VL002`); owner, `security definer`, `search_path` and grants of the replaced
functions are unchanged; the wrapper of H7 matches how auth-js calls `fetch`, causes no refresh
loop (the same retry rhythm as a plain 503) and still lets a real "signed out" answer through;
a local-only device makes no store write and no call at start.

**Final numbers.** `npm run check`: green, **2255 tests in 175 suites** (2173 in 168 before the audit);
`src/domain` at 100 %; web export succeeds; CI on the PR green.

**Last run.** On the final schema (both migrations) the catalogue checks (T30) and the invite
tests (T31–T33) were run again, word for word from the file, in rolled-back transactions: all
pass. A last run of the **whole** script could not be completed: the connector asked for a
confirmation that nobody was there to give, and nothing was executed. So T1–T29 were last run
after the first migration (pass); the second one only changes which role three trigger
functions run as and revokes nothing on this project. To close the gap, run
`supabase/tests/rls.sql` once in the SQL editor (it rolls itself back): the last result must be
`ALL RLS TESTS PASSED`. The database is as before the audit: 0 users, teams, members, records,
invites, holds and objects, the `keepalive` row, 9 migrations recorded.

### Should 10.0.1 be released?

**Yes.** The database fixes (H1, and deleting users in the dashboard) are live for every app
version already. The other ten fixes are in
the app and reach users only with a new build. C1 alone justifies it: on 10.0.0, "delete my
profile → restore my backup → sign in again" deletes a shared team's newer data for every
member, and H3 / H8 / H9 / H10 are further ways to lose shared data. H7 costs you one sign-in
email per device each time the project pauses. Nothing in the fixes changes stored data, so
10.0.0 → 10.0.1 is a plain update (and going back would work too). Not done here, as asked:
no version bump, no APK. To release: bump `app.json` + `package.json` to 10.0.1, add the version
to `docs/README_LEGACY.md` and the README's "What's new", then HANDOFF §5.

## Follow-ups (after the owner's answers)

Built on `feat/v10-audit-followups` after the audit was merged; DECISIONS #304–#308. No database
change, no new app version.

### "I already have a code" (M13)

The sign-in screen's email step has a second button, **I already have a code**. It opens the code
step for the typed email (checked like "Send code") and sends nothing. The code step then reads
"Enter the newest code we emailed to …. A code works for 10 minutes." and "Send a new code" can
be used at once. Files: `src/features/account/{useSignIn.ts,SignInScreen.tsx,CodeStep.tsx}`,
`src/i18n/{en,de}/account.ts`. Tests: `signIn.test.tsx` (5 cases: no email is sent, sign-in with
an earlier code, the email check, resend without a wait, the accessible name). Checked in a
browser on the web build (no request left the page).

### The previous scorer after a take-over (M1)

- A sync cycle now reads the live holds **first** (before the pull and the push; it was last).
- A match this device was scoring (its own hold was still running) that another device holds
  now is **yielded** while that hold lasts — also when the device learns it from a refused hold
  refresh, and also after its own live screen has closed.
- While yielded: the match and its sets are **not pushed** from this device, and a row another
  device saves for them **replaces** this device's unsynced change, whatever the save times say.
  The user gets a notice on the Teams tab ("Anna took over scoring a match of U18. 1 change made
  here that hadn't synced yet was undone.").
- **Nothing is thrown away without a newer save**: a rally the new scorer never saved over stays
  on the device, counts as "waiting" in the status, and is synced when the hold ends (released,
  run out after 15 minutes, or taken back on this device).
- A device that never held the match behaves as before. So does a device whose own hold had
  **run out** (the scorer without a connection for more than 15 minutes): the server only gives
  a running hold away on "Take over", so a lapsed one was not taken over — another device just
  claimed the free match.
- If the hold list can't be read (a server error; not "no connection"), the teams still sync
  with the holds known so far and the status shows the error — before, the holds were read
  last, so such an error never stood in the way of the data.

Files: `src/domain/syncAccess.ts` (`yieldedMatches`), `syncRecords.ts` (`matchOfRecord`),
`syncMerge.ts` (`MergeInput.takenOver`, `MergeOutput.yielded`), `types.ts` (notice kind
`takenOver`, runtime only); `src/lib/sync/holdState.ts` (new), `engine.ts`, `teamSync.ts`,
`holdCommands.ts`, `core.ts`; `src/features/sync/SyncNotices.tsx`, `src/i18n/{en,de}/sync.ts`.

Tests: `takeOverBlock.test.ts` (15 two-device scenarios: the M1 race; holds are read before the
pull; held back and synced after a release; after the hold has run out; a device whose clock
runs ahead still gives way; a refused refresh yields at once; taking the match back; sign-out;
a scorer whose own hold ran out, twice; this device's own save coming back; an unreadable hold
list, three times; a device that never held the match). `syncAccess.test.ts` (8 cases),
`syncMerge.test.ts` (7), `syncRecords.test.ts` (1), `syncStatusUi.test.tsx` (the notice in
English and German). One existing assertion in `syncMerge.test.ts` that compares the whole
output object got the new field `yielded: []`.

**Independent review** (a reviewer agent that hadn't written the code, with its own scratch
tests on a copy). What it found, and what was done:

| Review finding                                                                                                                                                                                                                                                                           | Done                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A new way to lose rallies: the first version also yielded when the device's own hold had merely run out. The real scorer, offline for 15+ minutes, then gave way to the previous scorer's still-open live screen (which re-claims every 5 minutes) and its offline rallies were replaced | fixed: only a hold that was still running counts as taken over. The reviewer's sequence is a test; the outcome is the same as on 10.0.0 (the scorer's rallies win) |
| This device's own earlier save, pulled back after a lost push answer, replaced its newer set with a "took over" notice                                                                                                                                                                   | fixed: only another device's row wins by force (test)                                                                                                              |
| The check "has the known hold run out?" at push time had no test                                                                                                                                                                                                                         | test added                                                                                                                                                         |
| Both test devices had the same profile name, so the holder's name in the notice proved nothing                                                                                                                                                                                           | the devices are "Coach" and "Ben" now                                                                                                                              |
| If the new scorer has already left live (hold released) before the old device syncs again, the old device doesn't yield                                                                                                                                                                  | left, as a limit (below): nothing tells the old device then; the latest save wins as on 10.0.0                                                                     |
| Expiry is judged by the device's clock; a clock 15 minutes ahead never yields                                                                                                                                                                                                            | left, as a limit (the same clock wins every conflict anyway, M2)                                                                                                   |
| A third device's older edit of the match also wins against the yielded device's later one                                                                                                                                                                                                | left: restricting the rule to the current holder's rows would reopen the overwrite after two take-overs in a row                                                   |

The reviewer's mutation runs (no push filter, no forced win, holds read after the teams, a hold
error aborting the cycle, a release clearing the yield, and others) were all caught by the
tests; it found nothing in the sign-in change. After the fixes each new test was checked to
fail when its fix is undone.

**Limits that remain** (DECISIONS #307; in all of them "the latest save wins", as on 10.0.0):

- The block is in the app — the server's hold is still advisory, so a 10.0.0 app doesn't yield.
- The new scorer's hold has already ended (it left the live screen) before the old device syncs
  again.
- The old device's own hold had run out before it learned of the take-over (offline for more
  than 10–15 minutes).
- A device clock that is minutes off.
- The yield is forgotten when the app restarts (the device isn't scoring then).
- A push that is already under way when the take-over happens can still land.
- Deleting a held match is still possible (M15).

### Numbers

`npm run check`: green, **2292 tests in 176 suites** (2255 in 175 before the follow-ups);
`src/domain` at 100 %; `npx expo export -p web` succeeds.

### Release

Unchanged: no version was bumped. The next build now also carries two things users can see (the
sign-in button, the take-over behaviour), so its notes should mention them; whether it is called
10.0.1 or 10.1.0 is the owner's choice.

## Medium / low fix log

The remaining MEDIUM and LOW findings that don't change how the sync engine merges, pushes or
pulls, fixed in four pull requests (2026-11-26, DECISIONS #309 onwards). The engine's own
findings are left for a second chat. Every fix has a test that fails without it, except pure
documentation and cleanup (marked "docs" / "cleanup").

| Finding                                    | Status                                                                                                                                                                                                                                                                                                                                                  | PR   | Proof (tests)                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1                                         | fixed before (Follow-ups)                                                                                                                                                                                                                                                                                                                               | #98  | `takeOverBlock.test.ts`                                                                                                                                                                                     |
| M2, M3, M4, M5, M6, M7, M12, M15, M18, M19 | second chat                                                                                                                                                                                                                                                                                                                                             | —    | —                                                                                                                                                                                                           |
| M8                                         | accepted by the owner (no CAPTCHA, DECISIONS #304)                                                                                                                                                                                                                                                                                                      | —    | —                                                                                                                                                                                                           |
| M10                                        | known limit, documented (`docs/SUPABASE.md` "Known limits")                                                                                                                                                                                                                                                                                             | PR 1 | docs                                                                                                                                                                                                        |
| L3, L7, L9, L10, L12                       | by design / known limit, documented (`docs/SUPABASE.md` "Known limits")                                                                                                                                                                                                                                                                                 | PR 1 | docs                                                                                                                                                                                                        |
| L8                                         | by design, documented (`docs/SUPABASE.md`, `README.md` "Share a team")                                                                                                                                                                                                                                                                                  | PR 1 | docs                                                                                                                                                                                                        |
| L13                                        | fixed: the advisor no longer reports the warning (checked 2026-11-26); `docs/SUPABASE.md` says so                                                                                                                                                                                                                                                       | PR 1 | docs                                                                                                                                                                                                        |
| L14                                        | accepted by the owner (6 digits, DECISIONS #304)                                                                                                                                                                                                                                                                                                        | —    | —                                                                                                                                                                                                           |
| L21                                        | fixed: "1 Änderung wird …" / "…, die noch nicht synchronisiert ist, kommt …"                                                                                                                                                                                                                                                                            | PR 1 | `src/i18n/de.test.ts` "use the singular verb for one change"                                                                                                                                                |
| L27                                        | fixed: `CLAUDE.md` names the optional backend; `docs/SUPABASE.md` names the profile name as the one profile field sent and drops `database.types.ts`; the design doc's §4 is marked as the plan, its file table says what was built; the tour's backup tip no longer says "Everything stays on this device" (EN + DE). HANDOFF §3 already said store 13 | PR 1 | docs                                                                                                                                                                                                        |
| L29                                        | left as it is (owner's instruction)                                                                                                                                                                                                                                                                                                                     | —    | —                                                                                                                                                                                                           |
| L30                                        | fixed: `teamMeta` removed; `TeamList` uses `useTeamAccess` / `useCanEdit`; `ci.yml` no longer hashes the missing `babel.config.js`; `scripts/screenshots.js` explains how to get Playwright when it is missing                                                                                                                                          | PR 1 | cleanup (existing `viewOnly.test.tsx`, `sharedTeamDelete.test.tsx` cover `TeamList`)                                                                                                                        |
| M11                                        | fixed: `memberships()` throws the error of `getSession()` (offline reads offline)                                                                                                                                                                                                                                                                       | PR 2 | `supabaseBackend.test.ts` "memberships: a session that can’t be refreshed offline reads offline"                                                                                                            |
| M13 (rest)                                 | fixed: own texts for a failed send (`mailFailed`: HTTP 500 on `/otp`, passed through by `authFetch.ts`) and a refused address (`emailRejected`)                                                                                                                                                                                                         | PR 2 | `authFetch.test.ts` (real supabase-js: 500 → mailFailed, 540 / 503 still offline; five refused-address codes), `errors.test.ts` "requestCodeError", `signIn.test.tsx` "has its own texts for a failed send" |
| M14                                        | fixed: `AccountLink` kind `restoring` ("Checking your sign-in…") on the Profile card, Cloud sync, Sign-in and Join                                                                                                                                                                                                                                      | PR 2 | `accountSection.test.tsx` (4 screens), `syncSetup.test.ts`                                                                                                                                                  |
| M16                                        | fixed: one map `t.sync.errors`; real limits in `tooMany`; Upload shows each team's reason                                                                                                                                                                                                                                                               | PR 2 | `cloudTeams.test.tsx` "says why one team failed"                                                                                                                                                            |
| M17                                        | fixed: sign-out when the sign-in screen closes on the question / during the check; at start (also after an offline start) for a stored session of another account that still has teams here                                                                                                                                                             | PR 2 | `signIn.test.tsx` (3 cases), `triggers.test.ts` (3 cases)                                                                                                                                                   |
| L11                                        | fixed in the app: a code joined in this run answers "joined" again; double submits ignored. Left: a join whose answer was lost on the network (needs `join_team` to answer members of the code's team)                                                                                                                                                  | PR 2 | `roles.test.ts` "a single-use manager code entered twice"                                                                                                                                                   |
| L15                                        | fixed: PGRST301 / 303 → refresh once, send again                                                                                                                                                                                                                                                                                                        | PR 2 | `supabaseBackend.test.ts` "a refused access token" (3 cases)                                                                                                                                                |
| L16                                        | fixed: the message check runs before the 401 / 403 rule                                                                                                                                                                                                                                                                                                 | PR 2 | `errors.test.ts` (403 / 401 with "Token has expired or is invalid")                                                                                                                                         |
| L22                                        | fixed: "Team without a name yet" (Download), "A team that isn't on this device" (delete account)                                                                                                                                                                                                                                                        | PR 2 | `cloudTeams.test.tsx`, `accountScreen.test.tsx`                                                                                                                                                             |
| L23                                        | fixed: "You were signed out. Sign in again." on the Cloud sync screen                                                                                                                                                                                                                                                                                   | PR 2 | `accountScreen.test.tsx`                                                                                                                                                                                    |
| L24                                        | fixed: the `removed` notice names both causes (the server can't tell them apart); `deleted` stays unused                                                                                                                                                                                                                                                | PR 2 | `syncStatusUi.test.tsx` (EN + DE)                                                                                                                                                                           |
| L6, L17, L18, L31                          | second chat                                                                                                                                                                                                                                                                                                                                             | —    | —                                                                                                                                                                                                           |

**Review of PR 2** (an independent reviewer agent, its own copy, typecheck + 350 tests): no
blocking finding. Fixed from its nits: the start-up check of M17 also runs when the session can
only be read after an offline start (`triggers.test.ts` "the same check when the session can
only be read after an offline start"); the boot re-checks that the engine is still running after
reading the session; two misplaced doc comments. Left, as limits: "Checking your sign-in…" stays
for as long as the session can't be read (offline or an outage, with an expired token) and has no
offline hint; any HTTP 500 on a code request reads "The email couldn't be sent" (also a database
outage of the auth server — the text is wrong then, nothing else); the join memo can answer
"joined" for a team the user was removed from moments ago, until the next cycle unlinks it.
