# v10 prompt — accounts and cloud sync with Supabase

Paste everything below the line into a NEW Claude session that has the `volley-lineup` repository attached and the Supabase connector connected (see "Before you start" in the chat where this was written, or the owner's notes).

---

Run `/start` first, then build **v10.0.0: accounts and cloud sync with Supabase**. This is the biggest change since v1: the app gets a backend for the first time. Until now it was local-only on purpose (DECISIONS #55, "Cloud sync / real accounts" in HANDOFF ideas).

## Your role: orchestrator

You are the **orchestrator**. Follow the pattern in `docs/HANDOFF.md` §4 exactly, and use agents heavily:

- **Plan agent** first: design the database schema, Row Level Security (RLS) policies, sync algorithm and the store / export migrations. Check its plan yourself before writing it into `docs/PLAN.md`.
- **Foundation yourself**: types, store migration, export schema, the sync interface, i18n stubs per worker, new routes pre-wired, version bump. Merge before workers start.
- **Workers** (Agent tool, `isolation: "worktree"`, in the background, in parallel where the files don't overlap). Each gets one branch + PR and a precise brief (task, owned files, forbidden files, decisions already made, tests, exact PR footer, "don't edit DECISIONS.md", "don't merge").
- **An independent reviewer agent per PR** (didn't write it): lint, typecheck, tests, web export, Playwright at 375 and 1280 px, EN + DE, dark + light, dyslexia font.
- **A dedicated security reviewer agent** for everything touching the database, RLS, auth and keys. Also run the `security-review` skill and the Supabase security / performance advisors. Nothing merges with an open security finding.
- **A QA agent** over the whole v10 acceptance checklist at the end, then fix and re-run QA.
- You merge (green CI only), write DECISIONS centrally (continue at the next free number), update docs, and release.

I'm not watching while you work. Don't stop to ask me questions, except for the owner decisions marked **ASK** below (one AskUserQuestion call with all of them at the start, with your recommendation first). For everything else: choose the simplest sensible option, write it in `docs/DECISIONS.md`, and keep going. Stop only before something irreversible (deleting the Supabase project or data, force-pushing `main`).

## Goal

Team managers and players can create an account, log in, and see the same team data on every device. Managers edit; players view. The app keeps working fully offline and without an account, exactly as today.

## Requirements

### 1. Backend: Supabase (hosted, free tier)

- Use the Supabase connector (MCP tools) to create tables, apply migrations, set RLS policies, configure Auth and read the security advisors. If the connector isn't available, see "If access is missing" below.
- Keep the database schema as SQL migration files in the repo (`supabase/migrations/*.sql`) so it can be recreated or moved to a self-hosted Supabase later. Every change to the live database goes through a migration file in a PR.
- The project already exists: **"Volleylineup manager"**, ref `qzeergfqfwovcvdarwua`, region `eu-central-2` (Zurich), Postgres 17. Use it; don't create another project. Check it's reachable with the connector before planning.
- The project was created with "Enable RLS on new tables automatically" **on** and "Grant API access to new tables automatically" **off**. So every migration that adds a table must also `GRANT` the needed privileges to the `authenticated` role explicitly (never to `anon` unless a decision says why), or the app can't reach the table.
- **RLS on every table, no exceptions.** Only members of a team can read it; only managers can write it. Write RLS tests (SQL or a test script) that prove: a stranger can't read a team, a player can't write, a manager of team A can't touch team B, a removed member loses access.
- The app uses only the **publishable / anon key** (public by design, protected by RLS). It may live in `app.config.js`. The `service_role` key must never be in the repo, the app, or a chat.
- **Keep-alive**: free projects pause after about a week without activity. Add a GitHub Actions workflow (`supabase-keepalive.yml`, `schedule` every 3 days plus `workflow_dispatch`) that makes one small read request with the publishable key against a tiny `keepalive` table (no personal data, read-only for `anon` by an explicit grant + RLS policy; note the decision). It fails loudly if the request fails. Note in the README that GitHub disables scheduled workflows in public repos after 60 days without commits, and how to re-enable it.
- Add `@supabase/supabase-js` with `EXPO_OFFLINE=1 npx expo install` (plus whatever session storage it needs on native) and note it in DECISIONS.

### 2. Offline-first sync

- The local Zustand store stays the source the UI reads. The app saves locally first, as now, and syncs in the background when online. Courtside Wi-Fi is unreliable: no screen may wait on the network.
- **All backend code lives in one module** (e.g. `src/lib/sync/` behind small functions like `pullTeam`, `pushChanges`, `subscribeTeam`), so swapping to a self-hosted server later means changing this module only. Screens and features never import `supabase-js` directly; add an ESLint rule that enforces it.
- The merge logic (what changed, which side wins) is **pure code in `src/domain/`** with 100% coverage.
- **Conflict rule: the most recent save wins per record** (per player, match, lineup set, preset, season, opponent). Deletions are tombstones (`deletedAt`) so they sync too. Decide and document how a live match being scored on one device behaves if another device edits it (simplest: whoever is scoring live "holds" that match; others see it read-only with a note).
- Show a small sync status (synced / syncing / offline / error) where it fits, with a manual "Sync now".
- Handle the server being unreachable or the free project being paused: the app keeps working locally and shows "offline", never an error screen or lost data.
- Live updates between devices (Supabase Realtime) are nice to have: build them if they fit cleanly, otherwise a sync on app open, on focus and after changes is enough.

### 3. Accounts and login

- Login is **optional**. Without an account the app works exactly like v9.2. Existing users must not lose anything after updating.
- Login method: **ASK** (recommend: a 6-digit code sent by email, because magic links are awkward to open in Expo Go and the APK).
- Decide how the existing local **profiles** relate to accounts (e.g. a signed-in account is linked to one local profile; "Log out" in the Profile tab signs out of the account too). Write it down.
- First sign-in on a device with existing data: offer to upload the local teams to the account (the user picks which teams). Never upload anything without asking.
- Account screen: signed-in email, sign out, delete account (required by app stores; deletes server data, keeps local data).

### 4. Teams, roles and invites

- A synced team has members with a role: **manager** (edit everything) and **player** (view only). **ASK** whether more roles are wanted (e.g. assistant coach / scorer who may run live mode).
- A manager creates an **invite code** (and a share link if simple) for a role; anyone signed in can join with the code. Codes can be revoked and expire.
- Managers see the member list and can change roles or remove members. The last manager can't leave or demote themselves.
- In view-only mode every edit control is hidden or disabled with a short reason, including drag and drop, the tap alternative, live mode, import "Replace" for that team, and presets.

### 5. Privacy

- **Confidential player descriptions** (v6, protected by biometric / PIN): **ASK** (recommend: they stay on the device and are never uploaded).
- **Photos** (players are often minors): **ASK** (recommend: sync to a private Supabase Storage bucket, readable only by team members, same 256 px size).
- The data is stored in Zurich (eu-central-2); say so in the README.

### 6. Data model, migrations and export

- Adding sync fields (ids that are stable across devices, `updatedAt`, `deletedAt`, team membership / remote link) changes the persisted shape: bump the store version (13) with a migration, and the export `schemaVersion` if the export changes. Old exports and the export golden must still import (see HANDOFF §6 gotchas). Sync bookkeeping that is device-only doesn't go in the export.
- JSON export / import keeps working for all users as a backup and a way to move away from Supabase.

### 7. Quality and docs

- Everything in `CLAUDE.md` applies: tests (domain 100%, a component test per feature, migration tests v1→v13), i18n EN + DE for every string, theme tokens, accessibility labels, 44 px targets, the label-in-name guard test.
- Jest tests mock the sync module; add one optional script that runs against the real Supabase project (not in CI by default).
- Update `docs/PLAN.md` (new v10 section with an acceptance checklist), `docs/DECISIONS.md`, `docs/VOLLEYBALL_RULES.md` if relevant, `docs/README_LEGACY.md` (version history + a "Backend" section: project, migrations, how to self-host later), `README.md` ("What's new", how to sign in, that the free server pauses after a week of no use and how the owner unpauses it, privacy note), and `docs/HANDOFF.md` via `/wrap-up`.
- Release v10.0.0 as in HANDOFF §5. If the work is too big for one release, split it (e.g. 10.0 accounts + manager sync, 10.1 player invites + view-only), but plan all of it up front.

## If access is missing

- **Supabase connector not connected, or its tools fail**: do all the work that doesn't need it (plan, SQL migration files, app code with the sync module mocked in tests), and tell me exactly what to connect. Don't fake a working backend.
- **Network blocked** for `<project-ref>.supabase.co` or `api.supabase.com`: ask for the host with your environment tools (I'll approve the card).
- **A key is needed**: use the secure credential form (`request_credential`), never ask me to paste a key in chat.

## Final report

Give me: what's new for users, the release link, the web URL, the acceptance checklist with pass / fail, every new decision, what wasn't verified on a real phone, the exact steps I still have to do in the Supabase dashboard (if any), and what to watch on the free tier.
