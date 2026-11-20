# Volley Lineup — Project Plan

## 1. Vision

A mobile + web app for volleyball team managers to manage their roster, build starting lineups for each set with simple drag and drop, and see the rotation for every set. Everything is stored locally on the device; data moves between devices with JSON export/import.

**Platforms:** iOS, Android, Web — one codebase.
**Users (v1):** team managers only.
**Backend:** none. All data stays on the device.

## 2. Assumptions (confirm or change before building)

- Indoor volleyball, 6 vs 6, court positions 1–6.
- Up to 5 sets per match.
- One libero per set (optional).
- "Accounts" = **local manager profiles** on the device (name + optional avatar colour). No passwords in v1: without a server, a password on local storage gives no real security. Data is shared between devices only through export/import.
- App language: English (strings kept in one file so German can be added later).

## 3. Features

### v1 (must have)

1. **Manager profiles** — create, select, rename, delete a local profile. Each profile owns its teams.
2. **Teams** — create, rename, delete teams (e.g. "Herren 1", season 2026/27).
3. **Roster** — add, edit, delete players: first name, last name, jersey number (unique per team), positions (Setter, Outside Hitter, Middle Blocker, Opposite, Libero, Defensive Specialist), active/injured flag.
4. **Matches** — create a match (opponent, date, home/away) inside a team.
5. **Lineup builder (per set)**
   - Court view with 6 slots (positions 1–6) + a bench list of all active players.
   - Drag a player from the bench onto a slot; drag between slots to swap; drag back to the bench to remove.
   - Tap-to-select fallback: tap a player, then tap a slot (for accessibility and small screens).
   - Libero slot next to the court.
   - Set tabs 1–5; "Copy lineup from previous set" button.
   - Choose who serves first in the set (us / opponent).
   - Validation: 6 different players, a player in only one slot, libero not in the 6 starting slots, warnings (not blocking) for missing setter / unusual position layout.
6. **Rotation viewer**
   - Steps through rotations 1–6 for the selected set (buttons + swipe).
   - Shows the front row (4, 3, 2) and back row (5, 6, 1), with the server (position 1) highlighted.
   - Shows player number, name and position badge on each spot.
7. **Starters overview** — one screen per match showing the starting six + libero for every set side by side.
8. **Export / import**
   - Export everything, or one team, as a `.json` file (download on web, share sheet on phone).
   - Import from a file, with a preview ("3 teams, 24 players") and a choice of merging or replacing.
   - A schema version in the file, validated on import; a bad file shows a clear error and never corrupts existing data.
9. **Persistence** — data survives app restarts and page reloads.

### Later (v2+ ideas, NOT in v1)

- Automatic libero swaps in the rotation view (libero replaces a chosen back-row player).
- Live match mode: tap "point won / lost" to rotate automatically, with a score per set.
- Substitution tracking (6 per set).
- 5-1 / 6-2 system templates.
- German translation.
- Cloud sync with a real backend and real accounts.
- Printable / PDF lineup sheet.

## 4. Rotation rules (domain logic)

- Positions: 1 = back right (server), 2 = front right, 3 = front middle, 4 = front left, 5 = back left, 6 = back middle.
- Rotating (after a side-out) moves each player clockwise: 2→1, 3→2, 4→3, 5→4, 6→5, 1→6.
- Rotation 1 = the starting lineup; rotations 2–6 follow by repeating the rule above.
- Front row = positions 2, 3, 4. Back row = 1, 5, 6.
- All of this lives in pure functions (`src/domain/rotation.ts`) with full unit tests.

## 5. Tech stack

| Area          | Choice                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Framework     | Expo (latest stable SDK) + React Native + react-native-web                                          |
| Language      | TypeScript (strict)                                                                                 |
| Navigation    | Expo Router                                                                                         |
| Drag & drop   | react-native-gesture-handler + react-native-reanimated                                              |
| State         | Zustand with `persist` middleware                                                                   |
| Storage       | @react-native-async-storage/async-storage (uses localStorage on web)                                |
| Validation    | zod (import files + forms)                                                                          |
| Export/import | expo-file-system + expo-sharing + expo-document-picker on phones; Blob download + file input on web |
| IDs           | nanoid / expo-crypto `randomUUID`                                                                   |
| Tests         | Jest (jest-expo) + React Native Testing Library                                                     |
| Lint/format   | ESLint + Prettier                                                                                   |
| CI            | GitHub Actions: lint, typecheck, test, web export                                                   |
| Web hosting   | GitHub Pages (via Actions, `expo export -p web`, base URL set for the repo path)                    |
| Phone testing | Expo Go (QR code)                                                                                   |

## 6. Data model

```ts
type Position = 'S' | 'OH' | 'MB' | 'OPP' | 'L' | 'DS';

interface ManagerProfile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  number: number; // unique within team
  positions: Position[]; // first = primary
  active: boolean;
}

interface Team {
  id: string;
  profileId: string;
  name: string;
  season?: string;
  createdAt: string;
}

interface Match {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  home: boolean;
  sets: SetLineup[]; // length 1–5
}

interface SetLineup {
  setNumber: 1 | 2 | 3 | 4 | 5;
  slots: Record<1 | 2 | 3 | 4 | 5 | 6, string | null>; // court position -> playerId
  liberoId: string | null;
  weServeFirst: boolean;
}

interface ExportFile {
  app: 'volley-lineup';
  schemaVersion: 1;
  exportedAt: string;
  profiles: ManagerProfile[];
  teams: Team[];
  players: Player[];
  matches: Match[];
}
```

## 7. Screens

1. **Profile picker** — list of profiles + "New profile".
2. **Teams** — the profile's teams.
3. **Team** — tabs: Roster | Matches.
4. **Player editor** — form (modal).
5. **Match** — set tabs 1–5 → Lineup builder; buttons for Rotation viewer and Starters overview.
6. **Lineup builder** — court + bench, drag and drop.
7. **Rotation viewer** — court, rotation 1–6 stepper.
8. **Starters overview** — all sets side by side.
9. **Settings** — switch profile, export, import, delete all data, app version.

Layout: on phones, the court is on top and the bench is a scrollable list below. On wide screens (web/tablet), the court is on the left and the bench on the right.

## 8. Design

- **Dark theme** by default.
- Colours (design tokens in `src/theme/colors.ts`):
  - Black background `#0D0D0D`, surface `#1A1A1A`, border `#2A2A2A`
  - Orange (primary, buttons, active states) `#FF6B00`
  - Volleyball yellow (highlights, the server, the selected set) `#FFC72C`
  - Volleyball blue (secondary, front row, links) `#0057B8` (use a lighter `#3D8BFF` for text on black)
  - Text `#FFFFFF`, muted text `#A0A0A0`, error `#FF4D4F`
- The court is drawn in orange with a white net line; player chips are round with the jersey number large, the name small, and the position badge coloured.
- All text must meet WCAG AA contrast. Touch targets are at least 44×44 px.
- Clear visual feedback while dragging: the lifted chip grows, and valid drop slots glow yellow.

## 9. Milestones

| #   | Milestone                           | Done when                                                                         |
| --- | ----------------------------------- | --------------------------------------------------------------------------------- |
| M0  | Scaffold                            | App runs on web + Expo Go, theme, navigation shell, store, CI is green            |
| M1  | Profiles, teams & roster            | CRUD works and persists                                                           |
| M2  | Rotation domain logic               | Pure functions + 100% unit test coverage                                          |
| M3  | Lineup builder                      | Drag and drop + tap fallback work on web and phone; validation                    |
| M4  | Rotation viewer + starters overview | All 6 rotations are correct for every set                                         |
| M5  | Export / import                     | Round trip export → wipe → import restores identical data; bad files are rejected |
| M6  | Polish + review                     | Independent review passed, README written, web deployed to GitHub Pages           |

## 10. Acceptance checklist (v1)

- [x] Create a profile, a team, 12 players, a match with 5 sets, all with no errors.
- [x] Drag and drop works with a mouse (web), touch (phone), and tap-to-select. — _Mouse, emulated touch and tap verified in a browser; native touch drag in Expo Go still needs a manual check on a real phone._
- [x] A player can't be placed twice in the same set.
- [x] The rotation viewer shows correct positions for all 6 rotations (verified by tests).
- [x] Reloading the page / restarting the app keeps all data.
- [x] Exporting, deleting all data and importing restores everything exactly.
- [x] Importing a broken or foreign JSON file shows an error and changes nothing.
- [ ] Lint, typecheck and tests pass in CI; the web build is live on GitHub Pages. — _CI green ✅; Pages deploy workflow ready but GitHub Pages must be enabled by the repo owner (private repo, see DECISIONS #49)._
- [x] The app looks right on a small phone (375 px wide) and on desktop.
