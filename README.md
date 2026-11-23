# Volley Lineup

A mobile + web app for volleyball team managers. Keep a roster, build the starting lineup for every set with drag and drop, step through all six rotations, follow a whole match live and see the stats. Everything is stored on your device — no account, no server. Move data between devices with a JSON export/import.

Built with Expo (React Native + react-native-web), TypeScript, Expo Router and Zustand. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and [`docs/DECISIONS.md`](docs/DECISIONS.md) for the choices made while building it.

## What it does

- **Manager profiles** — local profiles (name + colour). Each profile owns its teams.
- **Teams & roster** — players with name, jersey number (unique per team), positions (S, OH, MB, OPP, L, DS — first is primary) and an active/injured flag.
- **Matches** — opponent, date, home/away.
- **Lineup builder (per set, 1–5)** — drag a player from the bench onto a court position, between positions to swap, or back to the bench. No drag needed: tap a player, then tap a position. Libero slot, "copy lineup from previous set", and who serves first. Live checks: 6 different players, no player twice, libero not on court; warnings for a missing setter or an unusual layout.
- **Rotation viewer** — rotations 1–6 for any set (buttons, 1–6 stepper, or swipe). Front row in blue, the server (position 1) highlighted yellow.
- **Starters overview** — the starting six + libero of every set side by side.
- **Export / import** — export everything or one team as `.json`; import with a preview and a choice of merge or replace.
- **Persistence** — data survives app restarts and page reloads (AsyncStorage / localStorage).

New in **v2**:

- **Libero swaps** — choose which starters the libero replaces (the middles by default). The rotation viewer shows the libero in their back-row spot ("L for #6"), never at the serving position; a toggle shows the base lineup.
- **5-1 / 6-2 templates** — "Fill from template" fills the starting six from the roster by position and tells you which spots it couldn't fill.
- **Live match mode** — "Point us" / "Point them" keep the score, rotate on side-outs, show who serves and when it's set point. Undo any action. Once a set has live data its starting lineup is locked ("Reset live data" unlocks it).
- **Substitutions** — swap a court player for a bench player; the app counts subs (6 per set) and warns before a sub that breaks the limit or the re-entry rule. Libero swaps don't count.
- **Print / PDF** — a printable sheet with every set's starting six, libero, first serve and the roster (browser print on the web, a shareable PDF on the phone).
- **Deutsch** — the whole app in German: Settings → Language / Sprache.

Data from v1 (on the phone or in a v1 export file) opens in v2 automatically.

New in **v2.1 / v2.2**:

- **Navigation** — a bottom bar with Teams · Profile · Settings. The Profile tab edits your profile and has **Log out** (back to the profile list).
- **Lineup on phones** — the bench sits right under the court, so you can fill the lineup without scrolling.
- **Team nav bar** — inside a team: Roster · Matches · Presets · Starters.
- **Starters** — save the team's usual starting six + libero once; every new match starts with them in set 1.
- **Presets** — save named lineups (e.g. "Strong serve") and apply them to any set with "Apply preset…".

## Live web app

**https://nick-ze.github.io/volley-lineup/**

Deployed by `.github/workflows/deploy-pages.yml` on every push to `main`. One-time setup by the repository owner: **Settings → Pages → Build and deployment → Source: GitHub Actions**. GitHub Pages on a private repository needs a paid GitHub plan; on the free plan, make the repository public. Until Pages is enabled the workflow builds the site and skips the deploy step with a warning.

## Install on Android (APK)

The app works fully offline. All data is stored on your phone.

### Download

1. On your Android phone, open this repository on GitHub.
2. Tap **Releases** (on the right on desktop, further down the page on mobile).
3. Open the newest release (e.g. `v1.0.0`).
4. Under **Assets**, tap `volley-lineup-<version>.apk` to download it.

> The repository is private, so you need to be signed in to GitHub with access to it.

### Install

1. Open the downloaded file (from the download notification or the **Files** app → **Downloads**).
2. If Android asks, tap **Settings** and turn on **Allow from this source** for your browser or Files app, then go back.
3. Tap **Install**.
4. Tap **Open**. Volley Lineup is now on your home screen.

### Update to a new version

1. Download the newer APK from **Releases** the same way.
2. Open it and tap **Update**. Your teams and players stay saved.

> Before updating, it's a good idea to back up your data: **Settings → Export**.

### Troubleshooting

- **"App not installed"**: an older version signed with a different key is installed. Export your data, uninstall the old app, install the new one, then import your data.
- **Play Protect warning**: this appears because the app isn't from the Play Store. Tap **More details → Install anyway**.
- **Can't find the file**: check **Files → Downloads**, or download it again from Releases.

### Publishing a new version (maintainers)

1. Bump `version` in both `app.json` and `package.json` (e.g. `1.0.1`) and merge to `main`.
2. Either tag that commit and push the tag:
   ```bash
   git tag v1.0.1
   ```
   ```bash
   git push origin v1.0.1
   ```
   or, without a local tag: **Actions → Android APK → Run workflow** on `main` with **release** ticked (it creates the tag for you).
3. The **Android APK** workflow builds `volley-lineup-1.0.1.apk` (about 30 minutes) and publishes the release `v1.0.1`. The Android `versionCode` is derived from the version, so the new APK installs as an update.

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the App Store / Play Store (a version that supports Expo SDK 58).
2. On your computer (Node 22+):
   ```bash
   npm install
   ```
   ```bash
   npx expo start
   ```
3. Scan the QR code: with the Camera app on iPhone, or from inside Expo Go on Android. Phone and computer must be on the same Wi-Fi; otherwise use:
   ```bash
   npx expo start --tunnel
   ```

## Run it on the web

```bash
npx expo start --web
```

Production build (static files in `dist/`):

```bash
npx expo export -p web
```

New in **v3 — Match day & stats**:

- **Whole match in live mode** — the scoreboard shows the set score (e.g. "Sets 2:1"). When a set is won (25, or 15 in set 5, by 2) you get "Start set N+1" and "Undo last point". The next set is set up right there: team starters, a preset or a copy of the previous set, plus who serves first. At 3 sets won a match summary shows the result, every set's score and how long the match took. Undo works across a set end.
- **Results everywhere** — the match list and the match screen show "3:1 won", "1:3 lost" or "in progress"; the printed sheet can include the results.
- **Stats** — a Stats tab in the team (season record, set ratio, per-rotation points won / lost, side-out % and break points, and per-player sets started / played, subs, serve turns and points on serve) and a Stats button on every match. All numbers come from the rallies you already record.
- **Point details (optional)** — after a rally, one tap tags it: kill / ace / block / opponent error, or our error / their kill / their ace, with the player. Skip it by simply playing the next rally. Tags add kills, aces, blocks and errors to the player stats.

- **Names instead of numbers** (v3.1) — Settings → Player chips: show the player's name in the circle and the number below it.

Data from v2 (on the phone or in v1–v3 export files) opens in v3 automatically. Files exported by v3 (schema version 4) can't be opened by older versions.

New in **v4 — Roles on court**:

- **Roles** — every spot shows its role (S, OH, MB, OPP, DS) at the top; anyone can play any role: a role that isn't one of the player's positions asks "Are you sure?" and gets a "*" in the top-right corner. Substitutes take over the role (since v5 the roles come from the set's formation).
- **Rotate before the set** — ↺ / ↻ moves the whole starting six, so the setter can start at any position.
- **Rotation = setter position** — setter on 4 = "Rotation 4" in the rotation viewer, live mode and the per-rotation stats.
- **Libero** — choose which roles the libero replaces (middles, outsides, …) and switch the libero off when they should stay out.

Data and export files from earlier versions open in v4 automatically; files exported by v4 (schema version 5) can't be opened by older versions.

New in **v5 — Formations**:

- **Fixed formations** — every set (and preset / team starters) has a 5-1 or 6-2 formation, with the setter followed by an outside or a middle. The six court spots always show their roles — two middles, two outsides, setter and opposite (or two setters) opposite each other — even with nobody on court, so impossible layouts (e.g. two outsides next to each other) can't happen.
- **Players go onto spots** — a player on a spot that isn't one of their positions asks "Are you sure?" and gets a "*"; rotating turns the formation with the players.
- **Volleyball rules reference** — `docs/VOLLEYBALL_RULES.md` collects the rules that matter for the app (FIVB / DVV) and checks the app against them; point tags now only offer players who can actually block / serve an ace.

Data and files from v4 open automatically (the formation is worked out from where your setter stands); files exported by v5 (schema version 6) can't be opened by older versions.

New in **v6 — Players & performance**:

- **Photos** — give each profile and player a picture: take one with the camera or pick one from the gallery, change it or remove it. Photos are shrunk to a small 256 px JPEG and stay on the device. They show on the profile, in the roster, on the player page and on the bench; court chips keep the number or name.
- **Player page** — tap a player in the roster for their season: sets started and played, rallies on court ("x of y"), subs, serves and points on serve, kills / aces / blocks, errors by type and plus/minus, plus one line per match.
- **Confidential descriptions** — private notes per player, hidden until you unlock them with your fingerprint / face / device PIN (a confirmation on the web). They lock again when you press Lock, leave the app or restart it. They never show in lists or the print sheet, and go into an export file only if you tick **Include descriptions**.
- **Performance** — a new link on the match screen shows every player for a set or the whole match: rallies on court, won–lost, kills / aces / blocks vs errors and a simple rating (▲ ● ▼). Tap a player for their error rate and where the errors happened ("3 reception errors, 5 attack errors").
- **Error types** — "Our error" can now say what kind: Serve · Reception · Attack · Block · Set · Net / foul · Other. Still optional, one tap to skip.
- **Performance during the match** (v6.1) — in live mode, the **Performance** button at the top right shows every player's overview for the current set (or all sets); tap a player for their detail, then **Live** to go back to the court.
- **v6.2** — the performance list shows the best player first and the worst last; **search matches** by opponent or date (e.g. "Rivals", "21.11." or "2026-11"); **team starters can be partly filled** (e.g. only your 3 regulars) — new matches start with them and you pick the rest in the match before the game.

New in **v7 — Seasons & tournaments**:

- **Season boxes** — the team's Matches tab now shows your seasons and tournaments as boxes (name, dates, place, record). Create one with **New season / tournament**.
- **Matches live inside a season** — open a season for its matches (with search), its **Opponents** (the teams you play, with your record against each: won–lost, sets, upcoming) and its **Stats**.
- **Pick or add the opponent** — a new match offers the season's teams as buttons; type a new name and it's added to the season.
- **Stats per season** — the Stats tab can switch between seasons or show all of them.

Your existing matches move into one season per team automatically (named after the team's season, e.g. "2026/27"). Files exported by v7 (schema version 8) can't be opened by older versions.

New in **v8 — Look & feel**:

- **Light / dark mode** — Profile → Appearance: Dark (as before), Light, or System (follows your phone).
- **Dyslexia-friendly font** — Profile → Appearance: all text in OpenDyslexic.
- **Swiss dates** — every date shows as dd.mm.yy (22.11.26); date fields accept 22.11.26, 22.11.2026 or 2026-11-22.
- **Player cards** — the roster is a grid of cards with photo (or number), name, positions and active / injured.
- **First name first** — players are called by their first name ("#7 Anna"); the last name's initial is added when two players share a first name.
- **Team pictures** — give a team a photo; it shows in the team list, the team header and the season boxes.
- **Smooth transitions** — tabs slide in from the side you chose, a sideways swipe changes tabs, and players slide to their new spots when the lineup rotates (off when your device asks for reduced motion).
- **New app icon**.

New in **v8.1**: drag between tabs — the page follows your finger and the next tab slides in beside it; let go past a third (or flick) to switch, otherwise it springs back.

Your data opens automatically; files exported by v8 (schema version 9, with team pictures) can't be opened by older versions.

Data and files from v5 open automatically; files exported by v6 (schema version 7, with photos) can't be opened by older versions.

## Export / import

Open the **Settings** tab (bottom bar).

- **Export everything** writes all profiles, teams, players, matches (with their live data and point details), saved lineups and photos to `volley-lineup-YYYY-MM-DD.json`. Player descriptions are included only when **Include descriptions** is ticked (possible only while descriptions are unlocked). **Export <team>** writes just that team, its profile, players and matches. On the web the file is downloaded; on a phone the share sheet opens (save to Files, AirDrop, mail, …).
- **Import from file** opens a file picker, validates the file and shows a preview ("1 profile, 2 teams, 24 players, 5 matches"). Then choose:
  - **Replace** — your current data is replaced by the file.
  - **Merge** — items are matched by id; imported items win, nothing is deleted. If merging would make the data inconsistent (e.g. two players with the same number in a team) the merge is refused and you can use Replace instead.
- Files carry `app: "volley-lineup"` and a `schemaVersion`. A broken, foreign or newer-version file shows a clear error and **nothing is changed**.
- **Delete all data** wipes the device — profiles, teams, players, matches and saved lineups (after a confirmation). Export first if you want a backup.

To move data to another device: export on one, send the file, import on the other.

## Development

| Command                  | What it does                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `npm run lint`           | ESLint (+ Prettier)                                                                            |
| `npm run typecheck`      | `tsc --noEmit`                                                                                 |
| `npm test`               | Jest (jest-expo + React Native Testing Library); `-- --coverage` enforces 100% on `src/domain` |
| `npx expo export -p web` | Production web build                                                                           |

CI (`.github/workflows/ci.yml`) runs install → lint → typecheck → tests → web export on every push and pull request. Project rules for contributors (and AI agents) are in [`CLAUDE.md`](CLAUDE.md).

```
app/               Expo Router screens
src/domain/        Pure logic: rotation, lineup editing, validation, roster rules, export schema
src/store/         Zustand store + persistence
src/components/    Shared UI (Court, PlayerChip, Button, …)
src/features/      Feature components (roster, lineup, rotation, settings)
src/lib/           Platform helpers (.web.ts / .native.ts)
src/theme/         Light / dark colours, ThemeProvider + makeStyles, fonts, spacing, typography
scripts/           generate-icons.py (rebuilds assets/images from assets/source/app-icon-source.png)
src/i18n/          All user-facing strings
```
