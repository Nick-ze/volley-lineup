# Volley Lineup: version history and developer guide

This is the long ("legacy") README, kept for developers and AI agents working on the app. The short README for people
using the app is [`../README.md`](../README.md).

- **Version history**: what every version added, oldest first. **Add a section here for every new version.**
- **Reference**: export / import details, publishing an APK, the web deploy.
- **Development**: commands, CI, how "no visible change" is proved, folders.

Rules for contributors and AI agents: [`CLAUDE.md`](../CLAUDE.md). Current state and how work is done here:
[`HANDOFF.md`](HANDOFF.md). Full plan: [`PLAN.md`](PLAN.md). Every choice made: [`DECISIONS.md`](DECISIONS.md).

Built with Expo (React Native + react-native-web), TypeScript, Expo Router and Zustand. Data is stored on the device
(AsyncStorage / localStorage) and moved between devices with a JSON export / import. Since v10 an optional Supabase
backend syncs shared teams between devices (see [Backend](#backend)).

---

## Version history

Store version = the data saved on the device; export schema = the version inside `.json` export files. Every version
opens the data and export files of all older versions automatically; a file from a newer export schema can't be
opened by an older app.

### v1.0: the basics

- **Manager profiles**: local profiles (name + colour). Each profile owns its teams.
- **Teams & roster**: players with name, jersey number (unique per team), positions (S, OH, MB, OPP, L, DS; the first is
  primary) and an active / injured flag.
- **Matches**: opponent, date, home / away.
- **Lineup builder (per set, 1–5)**: drag a player from the bench onto a court position, between positions to swap, or
  back to the bench. No drag needed: tap a player, then tap a position. Libero slot, "copy lineup from previous set",
  and who serves first. Live checks: 6 different players, no player twice, libero not on court; warnings for a missing
  setter or an unusual layout.
- **Rotation viewer**: rotations 1–6 for any set (buttons, 1–6 stepper, or swipe). Front row in blue, the server
  (position 1) highlighted yellow.
- **Starters overview**: the starting six + libero of every set side by side.
- **Export / import**: export everything or one team as `.json`; import with a preview and a choice of merge or replace.
- **Persistence**: data survives app restarts and page reloads.

### v2.0: live match

- **Libero swaps**: choose which starters the libero replaces (the middles by default). The rotation viewer shows the
  libero in their back-row spot ("L for #6"), never at the serving position; a toggle shows the base lineup.
- **5-1 / 6-2 templates**: "Fill from template" fills the starting six from the roster by position and tells you which
  spots it couldn't fill.
- **Live match mode**: "Point us" / "Point them" keep the score, rotate on side-outs, show who serves and when it's set
  point. Undo any action. Once a set has live data its starting lineup is locked ("Reset live data" unlocks it).
- **Substitutions**: swap a court player for a bench player; the app counts subs (6 per set) and warns before a sub that
  breaks the limit or the re-entry rule. Libero swaps don't count.
- **Print / PDF**: a printable sheet with every set's starting six, libero, first serve and the roster (browser print on
  the web, a shareable PDF on the phone).
- **Deutsch**: the whole app in German (Settings → Language / Sprache).

### v2.1 / v2.2: navigation, starters, presets

- **Navigation**: a bottom bar with Teams · Profile · Settings. The Profile tab edits your profile and has **Log out**.
- **Lineup on phones**: the bench sits right under the court, so you can fill the lineup without scrolling.
- **Team nav bar**: inside a team: Roster · Matches · Presets · Starters.
- **Starters**: save the team's usual starting six + libero once; every new match starts with them in set 1.
- **Presets**: save named lineups (e.g. "Strong serve") and apply them to any set with "Apply preset…".

### v3.0: match day & stats (export schema 4)

- **Whole match in live mode**: the scoreboard shows the set score (e.g. "Sets 2:1"). When a set is won (25, or 15 in
  set 5, by 2) you get "Start set N+1" and "Undo last point". The next set is set up right there: team starters, a
  preset or a copy of the previous set, plus who serves first. At 3 sets won a match summary shows the result, every
  set's score and how long the match took. Undo works across a set end.
- **Results everywhere**: the match list and the match screen show "3:1 won", "1:3 lost" or "in progress"; the printed
  sheet can include the results.
- **Stats**: a Stats tab in the team (season record, set ratio, per-rotation points won / lost, side-out % and break
  points, per-player sets started / played, subs, serve turns and points on serve) and a Stats button on every match.
- **Point details (optional)**: after a rally, one tap tags it: kill / ace / block / opponent error, or our error /
  their kill / their ace, with the player. Skip it by playing the next rally.

### v3.1: names on chips (store 5)

- **Names instead of numbers** (renamed **Prioritise names** in v8.4): Settings → Player chips shows the player's name
  in the circle and the number below it.

### v4.0: roles on court (export schema 5)

- **Roles**: every spot shows its role (S, OH, MB, OPP, DS); a role that isn't one of the player's positions asks "Are
  you sure?" and gets a "*". Substitutes take over the role.
- **Rotate before the set**: ↺ / ↻ moves the whole starting six, so the setter can start at any position.
- **Rotation = setter position**: setter on 4 = "Rotation 4" in the rotation viewer, live mode and the stats.
- **Libero**: choose which roles the libero replaces and switch the libero off when they should stay out.

### v5.0: formations (export schema 6)

- **Fixed formations**: every set (and preset / team starters) has a 5-1 or 6-2 formation, with the setter followed by
  an outside or a middle. The six spots always show their roles, even with nobody on court, so impossible layouts
  can't happen.
- **Players go onto spots**: a player on a spot that isn't one of their positions asks "Are you sure?" and gets a "*";
  rotating turns the formation with the players.
- **Volleyball rules reference**: [`VOLLEYBALL_RULES.md`](VOLLEYBALL_RULES.md) collects the rules that matter (FIVB /
  DVV) and checks the app against them; point tags only offer players who can actually block / serve an ace.

### v6.0 – v6.2: players & performance (export schema 7)

- **Photos**: a picture for each profile and player (camera or gallery), shrunk to a 256 px JPEG, stored on the device.
  Shown on the profile, in the roster, on the player page and on the bench.
- **Player page**: tap a player for their season: sets, rallies on court, subs, serves, kills / aces / blocks, errors by
  type, plus / minus and one line per match.
- **Confidential descriptions**: private notes per player, hidden until unlocked with fingerprint / face / device PIN (a
  confirmation on the web). Exported only with **Include descriptions**.
- **Performance**: every player for a set or the whole match: rallies on court, won–lost, kills / aces / blocks vs
  errors and a rating (▲ ● ▼); tap a player for their error rates.
- **Error types**: "Our error" can say what kind: Serve · Reception · Attack · Block · Set · Net / foul · Other.
- **v6.1**: the Performance view inside live mode (button at the top right, **Live** to go back).
- **v6.2**: performance list best → worst; search matches by opponent or date; team starters can be partly filled.

### v7.0: seasons & tournaments (export schema 8)

- **Season boxes**: the team's Matches tab shows seasons and tournaments as boxes (name, dates, place, record).
- **Matches live inside a season**: a season has its matches (with search), its **Opponents** (with your record against
  each) and its **Stats**.
- **Pick or add the opponent**: a new match offers the season's teams as buttons; a new name is added to the season.
- **Stats per season**: the Stats tab can switch between seasons or show all of them.
- Existing matches moved into one season per team automatically.

### v8.0: look & feel (store 10, export schema 9)

- **Light / dark mode**: Profile → Appearance: Dark, Light, or System.
- **Dyslexia-friendly font**: Profile → Appearance: all text in OpenDyslexic.
- **Swiss dates**: dd.mm.yy everywhere; date fields accept 22.11.26, 22.11.2026 or 2026-11-22.
- **Player cards**: the roster is a grid of cards with photo (or number), name, positions and active / injured.
- **First name first**: "#7 Anna"; the last name's initial is added when two players share a first name.
- **Team pictures**: shown in the team list, the team header and the season boxes.
- **Smooth transitions**: tabs slide, a sideways swipe changes tabs, players slide when the lineup rotates (off with
  reduced motion).
- **New app icon**.

### v8.1 / v8.1.1: drag between tabs

- The page follows your finger and the next tab slides in beside it; let go past a third (or flick) to switch,
  otherwise it springs back. v8.1.1 removed the flicker (a real pager keeps the neighbouring tabs mounted).

### v8.2: full pictures on roster cards

- The roster cards show each player's picture in full (square, card width), with the name below.

### v8.3: code health (no visible change)

- Audit ([`AUDIT.md`](AUDIT.md)), cached match calculations (faster live scoring), big files split, shared UI kit,
  screen-reader labels start with the visible text, export golden test and screenshot harness, faster CI.

### v8.4: owner polish

- **Faded photo on court chips**: a player's picture shows faded behind the number (or name) on the court, rotation
  viewer, live court and starters. The bench keeps the full picture.
- **Spacing**: more room under the buttons at the top of the Roster, Matches and Presets tabs.
- **"Prioritise names"**: the Settings → Player chips switch has a clearer name (DE "Namen bevorzugen").

### v9.0: guided tour (store 11)

- **Tour choice on first start**: Full tour (every screen, briefly), Quick tour (profile → team → players → season →
  match → lineup; other screens ask "Quick tip for …?") or No tour.
- **Tip popups**: a short card at the bottom with a small picture (the button to tap, a player dragged onto the court,
  a swipe, …), step dots, Back / Next and End tour.
- **Profile → Tutorial**: choose again to restart, switch or end the tour.

### v9.1: team captain (store 12, export schema 10)

- **Captain**: one per team, set with the "Team captain" switch in the player form. A small yellow circle with a "C"
  at the top right of the captain's chip (court, bench, rotation, live, starters, presets) and roster card; "Captain" on
  the player page; "(C)" on the print sheet.

### v9.2: player list for the scorer

- **Player list (PDF)**: one page with every active player's number, last and first name, C for the captain and L for
  liberos (plus opponent, date and season when printed from a match) — to hand to the scorer. Match → Print / PDF →
  "Player list for the scorer", or Team → Roster → "Player list (PDF)". Print / PDF now always asks what to print.

### v10.0: accounts and cloud sync (store 13)

- **Optional accounts**: Profile → Cloud sync → Sign in with a 6-digit code sent by email. Without an account the app
  works exactly as before. The account belongs to one local profile; logging out of the profile signs out.
- **Shared teams**: upload your teams (you pick which) and download your cloud teams on another device. Changes are
  saved on the device first and sync in the background; the most recent save wins per player, match, set, preset,
  season, opponent and team; deletions sync too. Sync status (Synced / Syncing / Offline / error) on the Teams tab,
  "Sync now" on the Cloud sync screen.
- **Roles and invites**: managers edit, players only view (every edit control is hidden with a short note). Managers
  create invite codes / links (player codes many uses up to 30 days, manager codes once up to 7 days), revoke them,
  change roles and remove members; the last manager can't leave.
- **Live scoring across devices**: the device scoring a match holds it; others see it read-only and follow the score;
  managers can take over.
- **Privacy**: data in Zurich (eu-central-2); team and player photos in a private bucket for members only;
  confidential descriptions and profile photos never leave the device; delete account removes the server data.
- Store v13 adds the device-only `sync` state. The export file is unchanged (schema 10).

### v10.0.1: the v10 audit (no stored-data change)

A full audit of 10.0.0 (`docs/AUDIT_V10.md`: 1 critical, 10 high, 19 medium, 33 low findings) and its fixes. Store 13
and export schema 10 are unchanged, so 10.0.0 → 10.0.1 is a plain update. Three database migrations
(`20261126120000`, `20261126130000`, `20261126140000`) were applied to the hosted project before the release.

- **Data-loss fixes (update from 10.0.0)**: a shared team that leaves the device is unlinked in the same step (10.0.0
  could delete a shared team's cloud data after "delete profile → restore backup → sign in"); a cloud photo keeps its
  place while it can't be downloaded; a pull of several pages can't skip a record; a promoted viewer first takes the
  cloud's copy; an import can't empty a shared team or undo a sync that runs meanwhile; an outage of the sign-in
  server no longer signs devices out.
- **Invites**: codes end with the access of the people who know them (a removal revokes every open code of the team;
  a manager who stops being one revokes the open manager codes). Used-up manager codes aren't listed as active.
- **Sign-in**: "I already have a code" (no second email); own texts when the code email can't be sent or the address
  is refused; "Checking your sign-in…" while the stored session is read at start; one shared set of error texts.
- **Live scoring**: once another device has taken over, the previous scorer's device stops saving that match (its
  unsynced rallies wait, or give way to what the new scorer saves, with a notice); a match another device is scoring
  can't be deleted or overwritten by an import.
- **Sync engine**: an idle sync no longer rewrites the stored data; a record the cloud can't take (a name over 200
  characters, a refused id or character) waits with a notice instead of blocking the team's whole sync; slow
  connections get more time and smaller batches, and a stalled answer ends the request; a picture the cloud lost is
  kept and uploaded again.
- **Re-joining a team**: the app asks, and offers a backup, before a team's cloud version replaces an older copy on
  the device.
- **Roster / export**: duplicate jersey numbers (two devices adding a player at once) are shown on the Roster tab and
  in Settings → Export, because such a backup can't be imported.
- **Hardening**: sandboxed print frame, safe photo paths, a checked `sync` slice at load, supabase-js loaded only when
  needed, no secret key accepted by the build.
- Not included: the clock-skew change (audit M2; the owner decided to leave it — keep automatic time on).

---

## Backend

Since v10 the app can sync shared teams through **Supabase** (hosted project "Volleylineup manager",
`qzeergfqfwovcvdarwua`, region eu-central-2 Zurich, Postgres 17, free tier). Everything about it — schema, RLS model,
RPCs, error codes, limits, applying migrations, tests, keep-alive and the owner's dashboard steps — is in
[`SUPABASE.md`](SUPABASE.md); the sync design is [`V10_SYNC_DESIGN.md`](V10_SYNC_DESIGN.md).

- **Schema as code**: `supabase/migrations/*.sql` (applied in file order). Every change to the live database goes
  through a new migration file in a PR. RLS on every table; tables are read-only for signed-in users and every write
  goes through RPCs that check the caller's role.
- **Tests**: `supabase/tests/rls.sql` (runs in a rolled-back transaction: stranger can't read, player can't write, a
  manager of team A can't touch team B, a removed member loses access, …); `scripts/sync-live-check.mjs` runs the main
  flows against the real project with test users (`supabase/tests/test-users.sql`, then `test-users-cleanup.sql`). Not
  in CI. Jest mocks the sync module (`src/lib/sync/__mocks__`); the engine tests use an in-memory fake backend.
- **App side**: all backend code is in `src/lib/sync/` (ESLint forbids `@supabase/*` elsewhere); the merge rules are
  pure code in `src/domain/sync*.ts`. The app uses only the **publishable** key, in `supabase/public-config.json`
  (public by design; RLS protects the data). The service-role / secret key is never used.
- **Keep-alive**: `.github/workflows/supabase-keepalive.yml` reads a one-row table every 3 days (re-enable it under
  Actions after 60 days without commits).
- **Self-hosting later**: run a self-hosted Supabase (or any Postgres with PostgREST + GoTrue + Storage), apply the
  migrations in order (`supabase db push` or psql), keep `statement_timeout = 8s` on the `authenticated` role, set up the
  email OTP templates (`supabase/templates/`), and build the app with `EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_KEY` pointing at the new server. Users move their data with the JSON export / import or by
  uploading their teams again.

---

## Reference

### Export / import

Open the **Settings** tab.

- **Export everything** writes all profiles, teams, players, matches (with their live data and point details), saved
  lineups, seasons, opponents and photos to `volley-lineup-YYYY-MM-DD.json`. Player descriptions are included only
  when **Include descriptions** is ticked (possible only while descriptions are unlocked). **Export <team>** writes
  just that team, its profile, players and matches. On the web the file is downloaded; on a phone the share sheet
  opens.
- **Import from file** validates the file and shows a preview ("1 profile, 2 teams, 24 players, 5 matches"), then:
  - **Replace**: your current data is replaced by the file.
  - **Merge**: items are matched by id; imported items win, nothing is deleted. If merging would make the data
    inconsistent (e.g. two players with the same number in a team) the merge is refused.
- Files carry `app: "volley-lineup"` and a `schemaVersion`. A broken, foreign or newer-version file shows a clear error
  and **nothing is changed**.
- **Delete all data** wipes the device after a confirmation. Device settings (language, chip label, theme, font) stay.

### Publishing a new version (maintainers)

1. Bump `version` in both `app.json` and `package.json` (e.g. `8.4.1`), run `npm install --package-lock-only`, merge
   to `main`.
2. **Actions → Android APK → Run workflow** on `main` with **release** ticked (or push a `v8.4.1` tag from a machine
   that can push tags; the cloud sessions' git proxy can't).
3. The workflow builds `volley-lineup-8.4.1.apk` (about 25 minutes) and publishes the release `v8.4.1`. The Android
   `versionCode` is derived from the version, so the new APK installs as an update.
4. Add the version to the **Version history** above and, if users see a change, to "What's new" in the main README.

### Web deploy

`.github/workflows/deploy-pages.yml` deploys the web build to **https://nick-ze.github.io/volley-lineup/** on every push
to `main`, once the repository owner turns it on: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The repository is public since v9.0 (DECISIONS #247), so Pages and Actions are free. Until Pages is turned on the
workflow builds the site and skips the deploy with a warning.

---

## Development

| Command                  | What it does                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `npm install`            | Install dependencies (Node 22+)                                                                |
| `npx expo start`         | Dev server (`w` for web, QR code for Expo Go)                                                  |
| `npm run lint`           | ESLint (cached)                                                                                |
| `npm run format:check`   | Prettier check (`npm run format` fixes)                                                        |
| `npm run typecheck`      | `tsc --noEmit`                                                                                 |
| `npm test`               | Jest (jest-expo + React Native Testing Library); `-- --coverage` enforces 100% on `src/domain` |
| `npm run check`          | All of the above                                                                               |
| `npx expo export -p web` | Production web build (`dist/`)                                                                 |

CI (`.github/workflows/ci.yml`) runs three parallel jobs on every push and pull request: lint · format · typecheck,
tests (with coverage), and the web export. The brief for worker agents is [`WORKER_BRIEF.md`](WORKER_BRIEF.md).

**Proving "no visible change"** (refactors, performance work):

- `src/domain/__golden__/exportGolden.test.ts` (runs with `npm test`): a fixed data set must export byte for byte as
  before, and v1–v9 files must import to the same data. Rewrite the golden files only with a new export version
  (`UPDATE_GOLDEN=1 npx jest src/domain/__golden__`).
- `scripts/screenshots.js` (needs Playwright and ImageMagick, not in CI): shoots 31 screens at 375 / 1280 px, EN / DE,
  dark / light, dyslexia font off / on from a web build, and compares two runs pixel by pixel:

  ```
  npx expo export -p web --output-dir /tmp/before   # on the old commit
  node scripts/screenshots.js /tmp/before /tmp/shots-before
  # …same for the new commit, then:
  node scripts/screenshots.js --compare /tmp/shots-before /tmp/shots-after /tmp/diff
  ```

```
app/               Expo Router screens (thin)
src/domain/        Pure logic: rotation, lineup editing, live replay, stats, seasons, export schema (100 % tested)
src/store/         Zustand store + persistence (+ migrations), photo store
src/components/    Shared UI (Court, PlayerChip, Button, Dialog, tab pager, …)
src/features/      Feature components (roster, lineup, live, stats, seasons, …)
src/lib/           Platform helpers (.web.ts / .native.ts)
src/theme/         Light / dark colours, ThemeProvider + makeStyles, fonts, spacing, typography
src/i18n/          All user-facing strings (en/*, de/*)
src/test-utils/    Shared test helpers and fixtures
scripts/           generate-icons.py, screenshots.js
docs/              PLAN, DECISIONS, HANDOFF, AUDIT, VOLLEYBALL_RULES, WORKER_BRIEF, this file
```
