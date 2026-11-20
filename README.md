# Volley Lineup

A mobile + web app for volleyball team managers. Keep a roster, build the starting lineup for every set with drag and drop, and step through all six rotations. Everything is stored on your device — no account, no server. Move data between devices with a JSON export/import.

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

## Live web app

**https://nick-ze.github.io/volley-lineup/**

Deployed by `.github/workflows/deploy-pages.yml` on every push to `main`. One-time setup by the repository owner: **Settings → Pages → Build and deployment → Source: GitHub Actions**. GitHub Pages on a private repository needs a paid GitHub plan; on the free plan, make the repository public. Until Pages is enabled the workflow builds the site and skips the deploy step with a warning.

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

## Export / import

Open **Settings** (button in the top bar of the Teams screen).

- **Export everything** writes all profiles, teams, players and matches to `volley-lineup-YYYY-MM-DD.json`. **Export <team>** writes just that team, its profile, players and matches. On the web the file is downloaded; on a phone the share sheet opens (save to Files, AirDrop, mail, …).
- **Import from file** opens a file picker, validates the file and shows a preview ("1 profile, 2 teams, 24 players, 5 matches"). Then choose:
  - **Replace** — your current data is replaced by the file.
  - **Merge** — items are matched by id; imported items win, nothing is deleted. If merging would make the data inconsistent (e.g. two players with the same number in a team) the merge is refused and you can use Replace instead.
- Files carry `app: "volley-lineup"` and a `schemaVersion`. A broken, foreign or newer-version file shows a clear error and **nothing is changed**.
- **Delete all data** wipes the device (after a confirmation). Export first if you want a backup.

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
src/theme/         Colours, spacing, typography
src/i18n/          All user-facing strings
```
